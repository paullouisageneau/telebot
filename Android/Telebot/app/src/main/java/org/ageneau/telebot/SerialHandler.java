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

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Handle Bluetooth serial connection
 */
public class SerialHandler {

    private static final String TAG = "SerialHandler";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final TelebotActivity mActivity;
    private final BluetoothAdapter mBtAdapter;
    private String mDeviceName;

    private BluetoothSocket mBtSocket;
    private SerialThread mSerialThread;
    private String mDeviceAddress;

    /**
     * Constructor, set Bluetooth adapter and connect serial on device
     */
    public SerialHandler(TelebotActivity acticity, BluetoothAdapter adapter, String deviceName) throws IOException {

        mActivity = acticity;
        mBtAdapter = adapter;

        // Connect device
        connect(deviceName);
    }

    /**
     * Find Bluetooth device from name and connect serial
     */
    public void connect(String deviceName) throws IOException {

	    mDeviceName = deviceName;
    
        // Check if Bluetooth is enabled
        if(!mBtAdapter.isEnabled())
            throw new IOException("Bluetooth adapter is not enabled");

        // Look for Bluetooth device
        Set<BluetoothDevice> pairedDevices = mBtAdapter.getBondedDevices();
        for(BluetoothDevice device : pairedDevices) {
            if(device.getName().equals(deviceName)) {
                try {
                    Log.d(TAG, "Bluetooth device found");

                    // Retrieve address
                    mDeviceAddress = device.getAddress();
                    
                    // Connect serial port on device
                    mBtSocket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    mBtSocket.connect();
                    Log.d(TAG, "Bluetooth device connected");

                    // Create thread
                    mSerialThread = new SerialThread(mBtSocket);
                    mSerialThread.start();
                    break;
                }
                catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }

        if(mSerialThread == null)
            throw new IOException("Unable to connect Bluetooth device");

        // Reset control
        setControl(0, 0);

	    // Ask for battery status
        mSerialThread.writeln("B");
    }
    
    /**
     * Close serial
     */
    public void close() {
        try {
            if(mBtSocket != null) {
                setControl(0, 0);
                mBtSocket.close();
            }
        } catch (IOException e) {

        }

        mBtSocket = null;
        mSerialThread = null;
    }

    /**
     * Get device MAC address
     */
    public String getAddress() {
        return mDeviceAddress;
    }

    /**
     * Send motor control command, values are in percent
     */
    public void setControl(int left, int right) {

        while(true) {
            boolean success = false;
            if(mSerialThread != null) {
                success = mSerialThread.writeln("L " + left);  // left
                success&= mSerialThread.writeln("R " + right); // right
                success&= mSerialThread.writeln("C");          // commit
            }

            if(success) return;

            try {
                // Try to reconnect
                connect(mDeviceName);
            }
            catch(Exception e) {
                Log.w(TAG, "Unable to reconnect to Bluetooth device");
                return;
            }
        }
    }

    /**
     * Thread handling the BluetoothSocket
     */
    private class SerialThread extends Thread {
        private InputStream mInStream;
        private OutputStream mOutStream;

        public SerialThread(BluetoothSocket socket) throws IOException {
            mInStream = socket.getInputStream();
            mOutStream = socket.getOutputStream();
        }

        // Reception loop
        public void run() {
            if(mInStream == null) return;
            try {
                // Read lines from Bluetooth serial
                StringBuffer line = new StringBuffer();
                int chr;
                while((chr = mInStream.read()) >= 0) {
                    if(chr == '\n') {
			try {
				Log.d(TAG, "Received: " + line);
				process(line.toString());
			}
			catch(Exception e) {
				e.printStackTrace();
			}
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

        // Process received lines
        private void process(String line) {

            if (line == null || line.isEmpty())
                return;

            char cmd = line.charAt(0);
            String param = (line.length() >= 2 && line.charAt(1) == ' ' ? line.substring(2) : line.substring(1));

            switch (cmd) {
                case 'B':
                    int percent = Integer.parseInt(param);
                    mActivity.displayMessage("Battery: " + percent + " %");
                    break;

                default:
                    Log.d(TAG, "Unknown command \"" + cmd + "\"");
                    break;
            }
        }
        
        // Write line on Bluetooth serial
        public boolean writeln(String line) {
            try {
                if(mOutStream != null)
                    mOutStream.write((line + '\n').getBytes());
            } catch (IOException e) {
                Log.d(TAG, "Sending failed: " + e.getMessage());
                return false;
            }

            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }

            return true;
        }
    }
}
