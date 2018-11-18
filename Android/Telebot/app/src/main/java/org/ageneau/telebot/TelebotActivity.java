/*
 * This file is part of Telebot Android app
 * Copyright (c) 2015-2017 by Paul-Louis Ageneau
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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

/**
 * Telebot activity
 */
public class TelebotActivity extends Activity  {

    private static final String TAG = "TelebotActivity";
    
    // Configuration
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

    /**
     * Connect Bluetooth device, launch background HTTP server, and launch browser
     */
    private void launch() {
        // Get the Bluetooth adapter
        mBtAdapter = BluetoothAdapter.getDefaultAdapter();
        if(mBtAdapter == null) {
            finishWithError("Bluetooth support is required.");
            return;
        }

        // Check if Bluetooth is enabled
        if(!mBtAdapter.isEnabled()) {
            // Prompt user to turn Bluetooth on
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(enableBtIntent, BLUETOOTH_REQUEST_CODE);
            return;
        }

        Log.d(TAG, "Bluetooth is enabled");

        final TelebotActivity activity = this;
        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                // Connect the Bluetooth device
                SerialHandler handler;
                try {
                    handler = new SerialHandler(activity, mBtAdapter, DEVICE_NAME);
                } catch (IOException e) {
                    e.printStackTrace();
                    finishWithError("Unable to connect to the Bluetooth device. Please check it is paired.");
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
                    finishWithError("You need to install Google Chrome or Mozilla Firefox.");
                    return;
                }
            }
        });
    }

    /**
     * Display a message
     */
    public void displayMessage(String message) {
        final String msg = message;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast toast = Toast.makeText(getBaseContext(), msg, Toast.LENGTH_LONG);
                toast.show();
            }
        });
    }

    /**
     * Display an error message and schedule termination
     */
    public void finishWithError(String message) {
        // Display error on screen
        displayMessage("Error: " + message);

        // Log error
        Log.e(TAG, message);

        // Schedule termination
        finish();
    }
}
