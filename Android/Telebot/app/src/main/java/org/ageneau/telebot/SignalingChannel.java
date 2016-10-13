/*
 * Copyright (c) 2014, Ericsson AB.
 * Copyright (c) 2015-2016, Paul-Louis Ageneau
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this
 * list of conditions and the following disclaimer in the documentation and/or other
 * materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
 * OF SUCH DAMAGE.
 */

// This is a modified version of OpenWebRTC simple signaling channel for Android
// https://github.com/EricssonResearch/openwebrtc-examples/blob/master/android/NativeCall/app/src/main/java/com/ericsson/research/owr/examples/nativecall/SignalingChannel.java

package org.ageneau.telebot;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class SignalingChannel {
    public static final String TAG = "SignalingChannel";

    private final Handler mMainHandler;
    private final String mClientToServerUrl;
    private final String mServerToClientUrl;
    private Handler mSendHandler;
    private Map<String, Peer> mPeerChannels = new HashMap<>();
    private JoinListener mJoinListener;
    private DisconnectListener mDisconnectListener;
    private SessionFullListener mSessionFullListener;

    public SignalingChannel(String baseUrl, String session, String user) {
        mServerToClientUrl = baseUrl + "/stoc/" + session + "/" + user;
        mClientToServerUrl = baseUrl + "/ctos/" + session + "/" + user;
        mMainHandler = new Handler(Looper.getMainLooper());
        Thread sendThread = new SendThread();
        sendThread.start();
    }

    public void open() throws IOException {
        final URL url = new URL(mServerToClientUrl);
        final HttpURLConnection urlConnection = (HttpURLConnection) url.openConnection();

        Thread t = new Thread(new Runnable() {
            private HttpURLConnection connection = urlConnection;
            @Override
            public void run() {
                try {
                    InputStream eventStream = connection.getInputStream();
                    BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(eventStream));
                    readEventStream(bufferedReader);
                }
                catch (IOException e) {
                    Log.e(TAG, e.toString());
                    e.printStackTrace();
                }
                finally {
                    connection.disconnect();
                    mMainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            for (Peer peer : mPeerChannels.values()) {
                                peer.onDisconnect();
                            }
                            if (mDisconnectListener != null) {
                                mDisconnectListener.onDisconnect();
                            }
                        }
                    });
                }
            }
        });

        t.start();
    }

    private class SendThread extends Thread {
        @Override
        public void run() {
            Looper.prepare();
            mSendHandler = new Handler();
            Looper.loop();
            Log.d(TAG, "SendThread: quit");
        }
    }

    private void readEventStream(final BufferedReader bufferedReader) throws IOException {
        String line;
        while ((line = bufferedReader.readLine()) != null) {
            if (line.length() > 1) {
                String[] eventSplit = line.split(":", 2);

                if (eventSplit.length != 2 || !eventSplit[0].equals("event")) {
                    Log.w(TAG, "Invalid event: " + line + " => " + Arrays.toString(eventSplit));
                    while (!(line = bufferedReader.readLine()).isEmpty()) {
                        Log.w(TAG, "Skipped after malformed event: " + line);
                    }
                    break;
                }

                final String event = eventSplit[1];

                if ((line = bufferedReader.readLine()) != null) {
                    final String[] dataSplit = line.split(":", 2);

                    if (dataSplit.length != 2 || !dataSplit[0].equals("data")) {
                        Log.w(TAG, "Invalid data: " + line + " => " + Arrays.toString(dataSplit));
                    }
                    final String data = dataSplit[1];

                    mMainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            handleEvent(event, data);
                        }
                    });
                }
            }
        }
    }

    private void handleEvent(final String event, final String data) {
        if (event.startsWith("user-")) {
            String peer = event.substring(5);
            Peer peerChannel = mPeerChannels.get(peer);
            if (peerChannel != null) {
                peerChannel.onMessage(data);
            }
        } else if (event.equals("join")) {
            Peer peer = new Peer(data);
            mPeerChannels.put(data, peer);
            if (mJoinListener != null) {
                mJoinListener.onPeerJoin(peer);
            }
        } else if (event.equals("leave")) {
            Peer peer = mPeerChannels.remove(data);
            if (peer != null) {
                peer.onDisconnect();
            }
        } else if (event.equals("sessionfull")) {
            if (mSessionFullListener != null) {
                mSessionFullListener.onSessionFull();
            }
        } else {
            Log.w(TAG, "Unhandled event: " + event);
        }
    }

    public void setJoinListener(JoinListener joinListener) {
        mJoinListener = joinListener;
    }

    public void setDisconnectListener(DisconnectListener onDisconnectListener) {
        mDisconnectListener = onDisconnectListener;
    }

    public void setSessionFullListener(final SessionFullListener sessionFullListener) {
        mSessionFullListener = sessionFullListener;
    }

    public interface MessageListener {
        void onMessage(JSONObject data);
    }

    public interface JoinListener {
        void onPeerJoin(final Peer peer);
    }

    public interface SessionFullListener {
        void onSessionFull();
    }

    public interface DisconnectListener {
        void onDisconnect();
    }

    public interface PeerDisconnectListener {
        public void onPeerDisconnect(final Peer peer);
    }

    public class Peer {
        private final String mPeerId;
        private MessageListener mMessageListener;
        private PeerDisconnectListener mDisconnectListener;
        private boolean mDisconnected = false;

        private Peer(String peerId) {
            mPeerId = peerId;
        }

        public void send(final JSONObject message) {
            if (mDisconnected) {
                Log.w(TAG, "Tried to send message to disconnected peer: " + mPeerId);
                return;
            }
            mSendHandler.post(new Runnable() {
                @Override
                public void run() {

                    HttpURLConnection urlConnection = null;
                    try {
                        byte[] bytes = message.toString().getBytes("UTF8");
                        URL url = new URL(mClientToServerUrl + "/" + mPeerId);
                        urlConnection = (HttpURLConnection) url.openConnection();
                        urlConnection.setDoOutput(true);
                        urlConnection. setFixedLengthStreamingMode(bytes.length);

                        OutputStream out = urlConnection.getOutputStream();
                        out.write(bytes);
                        out.close();

                        if(urlConnection.getResponseCode() != 200) {
                            Log.e(TAG, "Failed to send message to " + mPeerId);
                        }
                    }
                    catch (IOException e) {
                        Log.e(TAG, e.toString());
                        e.printStackTrace();
                    } finally {
                        if(urlConnection != null) {
                            urlConnection.disconnect();
                        }
                    }
                }
            });
        }

        private void onMessage(String message) {
            if (mDisconnected) {
                Log.w(TAG, "Received message from disconnected peer: " + mPeerId);
                return;
            }
            if (mMessageListener != null) {
                try {
                    JSONObject json = new JSONObject(message);
                    mMessageListener.onMessage(json);
                } catch (JSONException e) {
                    Log.w(TAG, "Failed to decode message: " + e);
                }
            }
        }

        private void onDisconnect() {
            mDisconnected = true;
            if (mDisconnectListener != null) {
                mDisconnectListener.onPeerDisconnect(this);
                mDisconnectListener = null;
                mMessageListener = null;
            }
        }

        public void setMessageListener(final MessageListener messageListener) {
            mMessageListener = messageListener;
        }

        public void setDisconnectListener(final PeerDisconnectListener onDisconnectListener) {
            mDisconnectListener = onDisconnectListener;
        }

        public String getPeerId() {
            return mPeerId;
        }

        @Override
        public String toString() {
            return "User[" + mPeerId + "]";
        }
    }
}
