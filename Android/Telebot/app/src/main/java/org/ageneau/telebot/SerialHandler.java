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

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

public class SerialHandler {

    private static final String TAG = "SerialHandler";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter mBtAdapter;
    private BluetoothSocket mBtSocket;
    private String mAddress;
    private SerialThread mSerialThread;

    public SerialHandler(BluetoothAdapter adapter, String deviceName) throws IOException {

        mBtAdapter = adapter;

        // Check if Bluetooth is enabled
        if(mBtAdapter == null || !mBtAdapter.isEnabled())
            throw new IOException("Bluetooth adapter is not enabled");

        // Look for Bluetooth device
        Set<BluetoothDevice> pairedDevices = mBtAdapter.getBondedDevices();
        for(BluetoothDevice device : pairedDevices) {
            if(device.getName().equals(deviceName)) {
                try {
                    Log.d(TAG, "Found Bluetooth device ");

                    // Connect serial port on device
                    mBtSocket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    mBtSocket.connect();
                    Log.d(TAG, "Bluetooth device connected");

                    // Create thread
                    mSerialThread = new SerialThread(mBtSocket);
                    mSerialThread.start();

                    // Retrieve address
                    mAddress = device.getAddress();
                    break;
                }
                catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }

        if(mSerialThread == null)
            throw new IOException("Unable to connect Bluetooth device");
    }

    public void close() {
        try {
            if(mBtSocket != null) {
                setControl(0, 0);
                mBtSocket.close();
            }
        } catch (IOException e) {

        }

        mSerialThread = null;
    }

    public String getAddress() {
        return mAddress;
    }

    // Send motor control command, values are in percent
    public void setControl(int left, int right) {
        if(mSerialThread != null) {
            mSerialThread.writeln("L " + left);  // left
            mSerialThread.writeln("R " + right); // right
            mSerialThread.writeln("C");          // commit
        }
    }

    // Thread handling the BluetoothSocket
    private class SerialThread extends Thread {
        private InputStream mInStream;
        private OutputStream mOutStream;

        public SerialThread(BluetoothSocket socket) throws IOException {
            mInStream = socket.getInputStream();
            mOutStream = socket.getOutputStream();
        }

        public void run() {
            if(mInStream == null) return;
            try {
                // Read lines from Bluetooth serial
                StringBuffer line = new StringBuffer();
                int chr;
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
}
