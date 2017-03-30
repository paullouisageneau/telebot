/*
 * Copyright (c) 2015-2017, Paul-Louis Ageneau
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

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Bundle;
import android.util.Log;
import android.view.Window;
import android.widget.Toast;

import java.io.IOException;
import java.util.Locale;
import java.util.Random;

public class TelebotActivity extends Activity  {

    private static final String TAG = "TelebotActivity";
    private static final String URL = "https://telebot.ageneau.net";
    private static final String DEVICE_NAME = "Telebot";
    private static final int HTTP_SERVER_PORT = 11698;

    private static final int BLUETOOTH_REQUEST_CODE = 1;
    private static final int BROWSER_REQUEST_CODE = 2;

    private BluetoothAdapter mBtAdapter;
    private SerialHttpServer mServer;
    private String mSessionId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.telebot_activity);

        Random rand = new Random();
        mSessionId = String.format(Locale.US, "%06d", rand.nextInt(1000000));
    }

    @Override
    protected void onDestroy() {
        if(mServer != null) {
            mServer.stop();
            mServer = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onStart() {
        super.onStart();
        launch();
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
        switch(requestCode)
        {
            case BLUETOOTH_REQUEST_CODE:
                // Bluetooth is now activated, re-launch
                launch();
                break;

            case BROWSER_REQUEST_CODE:
                // If the browser session ends, close the app
                finish();
                break;
        }
    }

    private void launch() {
        // Get the Bluetooth adapter
        mBtAdapter = BluetoothAdapter.getDefaultAdapter();
        if(mBtAdapter == null)
            exit("Bluetooth support is required.");

        // Check if Bluetooth is enabled
        if(!mBtAdapter.isEnabled()) {
            // Prompt user to turn Bluetooth on
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(enableBtIntent, BLUETOOTH_REQUEST_CODE);
            return;
        }

        Log.d(TAG, "Bluetooth is enabled");

        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                // Connect the Bluetooth device
                SerialHandler handler;
                try {
                    handler = new SerialHandler(mBtAdapter, DEVICE_NAME);
                } catch (IOException e) {
                    e.printStackTrace();
                    exit("Unable to connect to the Bluetooth device. Please check it is paired.");
                    return;
                }

                // Retrieve session ID
                mSessionId = String.format(Locale.US, "%06d", Math.abs(handler.getAddress().hashCode()) % 1000000);

                // Start the control server
                mServer = new SerialHttpServer(HTTP_SERVER_PORT, handler);
                mServer.start();

                // Force sound through speaker
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(true);

                // Finally, start the browser to actually handle the WebRTC session
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setData(Uri.parse(URL + "/#_" + mSessionId));
                i.setPackage("com.android.chrome");
                try {
                    try {
                        startActivityForResult(i, BROWSER_REQUEST_CODE);
                    } catch (ActivityNotFoundException e) {
                        i.setPackage("org.mozilla.firefox");
                        startActivityForResult(i, BROWSER_REQUEST_CODE);
                    }
                } catch (ActivityNotFoundException e) {
                    exit("You need to install Google Chrome or Mozilla Firefox.");
                    return;
                }
            }
        });
    }

    private void exit(final String message) {
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
}
