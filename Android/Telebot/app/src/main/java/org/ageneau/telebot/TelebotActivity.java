/*
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

package org.ageneau.telebot;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Bundle;
import android.util.Log;
import android.view.Window;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

public class TelebotActivity extends Activity implements
        SignalingChannel.JoinListener,
        SignalingChannel.DisconnectListener,
        SignalingChannel.SessionFullListener,
        SignalingChannel.MessageListener,
        SignalingChannel.PeerDisconnectListener {

    // Settings
    private static final String TAG = "Telebot";
    private static final String URL = "https://ageneau.net/telebot";
    private static final String USER_ID = "telebot";
    private static final String DEVICE_NAME = "Telebot";

    // Well-known Serial Port Profile UUID
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private SignalingChannel mSignaling;
    private SignalingChannel.Peer mPeer;

    private BluetoothAdapter mBtAdapter;
    private BluetoothSocket mBtSocket;
    private SerialThread mSerialThread;

    private String mSessionId;
    private String mUserId;

    @SuppressLint("DefaultLocale")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.telebot_activity);

        Random rand = new Random();
        mSessionId = String.format("%06d", rand.nextInt(1000000));
        mUserId = USER_ID;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            if(mBtSocket != null) mBtSocket.close();
        } catch (IOException e) {

        }
    }

    @Override
    protected void onStart() {
        super.onStart();

        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                // Initialize serial
                if(!initSerial()) return;

                // Join session
                join(mSessionId, mUserId);

                // Force sound through speaker
                AudioManager audioManager = (AudioManager)getSystemService(Context.AUDIO_SERVICE);
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(true);

                // Finally, start the browser to actually handle WebRTC
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setData(Uri.parse(URL + "/#_" + mSessionId));
                startActivityForResult(i, 2);
            }
        });
    }

    @Override
    protected void onStop() {
        super.onStop();
        // DO NOTHING HERE, onStop will be called when the browser is put on top
    }

    @Override
    public void onResume() {
        super.onResume();

    }

    @Override
    public void onPause() {
        super.onPause();

    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if(requestCode == 2) {
            // If the browser session ends, close the app
            finish();
        }
    }

    private void exitWithError(final String message) {
        // Display error on screen
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast toast = Toast.makeText(getBaseContext(), "Error: " + message, Toast.LENGTH_LONG);
                toast.show();
            }
        });

        // Log error
        Log.e(TAG, message);

        // Schedule termination
        finish();
    }

    // Initialize Bluetooth serial
    @SuppressLint("DefaultLocale")
    private boolean initSerial() {
        // Get the Bluetooth adapter
        mBtAdapter = BluetoothAdapter.getDefaultAdapter();
        if(mBtAdapter == null) {
            exitWithError("Bluetooth not supported");
            return false;
        }

        // Check if Bluetooth is enabled
        if(mBtAdapter.isEnabled()) {
            Log.d(TAG, "Bluetooth is enabled");
        }
        else {
            // Prompt user to turn Bluetooth on
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(enableBtIntent, 1);
        }

        // Look for Bluetooth device
        Set<BluetoothDevice> pairedDevices = mBtAdapter.getBondedDevices();
        for(BluetoothDevice device : pairedDevices) {
            if(device.getName().equals(DEVICE_NAME)) {
                try {
                    Log.d(TAG, "Found Bluetooth device ");

                    // Connect serial port on device
                    mBtSocket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    mBtSocket.connect();
                    Log.d(TAG, "Bluetooth device connected");

                    // Create thread
                    mSerialThread = new SerialThread(mBtSocket);
                    mSerialThread.start();

                    // Retrieve session ID by hashing device address
                    mSessionId = String.format("%06d", Math.abs(device.getAddress().hashCode()) % 1000000);
                    break;
                }
                catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }

        if(mSerialThread == null) {
            exitWithError("Unable to connect to Bluetooth device. Please check it is paired.");
            return false;
        }

        return true;
    }

    // Thread handling the BluetoothSocket
    private class SerialThread extends Thread {
        private InputStream mInStream;
        private OutputStream mOutStream;

        public SerialThread(BluetoothSocket socket) throws IOException {
            mInStream = socket.getInputStream();
            mOutStream = socket.getOutputStream();
            //writeln("M 255");
        }

        public void run() {
            if(mInStream == null) return;
            try {
                // Read lines from Bluetooth serial
                int chr;
                StringBuffer line = new StringBuffer();
                while((chr = mInStream.read()) >= 0) {
                    if(chr == '\n') {
                        Log.d(TAG, "Received: " + line);
                        line.setLength(0);
                    }
                    else {
                        if(chr != '\r')
                            line.append((char)chr);
                    }
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        // Write line on Bluetooth serial
        public void writeln(String line) {
            try {
                if(mOutStream != null) mOutStream.write((line + '\n').getBytes());
                Thread.sleep(10);
            } catch (IOException e) {
                Log.d(TAG, "Sending failed: " + e.getMessage());
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

    public void join(String sessionId, String userId) {
        Log.d(TAG, "joining: " + sessionId);
        mSignaling = new SignalingChannel(URL, sessionId, userId);
        mSignaling.setJoinListener(this);
        mSignaling.setDisconnectListener(this);
        mSignaling.setSessionFullListener(this);
    }

    @Override
    public void onPeerJoin(final SignalingChannel.Peer peer) {
        Log.d(TAG, "onPeerJoin => " + peer.getPeerId());

        mPeer = peer;
        mPeer.setDisconnectListener(this);
        mPeer.setMessageListener(this);
    }

    @Override
    public void onPeerDisconnect(final SignalingChannel.Peer peer) {
        Log.d(TAG, "onPeerDisconnect => " + peer.getPeerId());
        mPeer = null;
        setControl(0, 0);
    }

    @Override
    public synchronized void onMessage(final JSONObject json) {
        Log.d(TAG, "onMessage => " + json.toString());

        if (json.has("control")) {
            try {
                JSONObject control = json.optJSONObject("control");
                int left = control.getInt("left");
                int right = control.getInt("right");
                Log.v(TAG, "control: " + left + ", " + right);
                setControl(left, right);
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onDisconnect() {
        mSignaling = null;
        setControl(0, 0);
        exitWithError("Disconnected from server");
    }

    @Override
    public void onSessionFull() {
        exitWithError("Session is full, please wait");
    }

    // Send motor control command, values are in percent
    private void setControl(int left, int right) {
        if(mSerialThread != null) {
            mSerialThread.writeln("L " + left);  // left
            mSerialThread.writeln("R " + right); // right
            mSerialThread.writeln("C");          // commit
        }
    }
}
