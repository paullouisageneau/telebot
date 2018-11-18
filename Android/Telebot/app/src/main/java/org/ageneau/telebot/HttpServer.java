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

import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.util.HashMap;
import java.util.Map;

/**
 * Tiny HTTP server implementation for JSON requests
 * HTTP access control (CORS) is supported
 */
public class HttpServer implements Runnable {

    private static final String TAG = "HttpServer";
    
    private final int mPort;
    private ServerSocket mServerSocket;

    /**
     * Create server for specified port
     */
    public HttpServer(int port) {
        mPort = port;
    }

    /**
     * Start the server
     */
    public void start() {
        Thread t = new Thread(this);
        t.start();
    }

    /**
     * Stop the server
     */
    public void stop() {
        try {
            if(mServerSocket != null) {
                mServerSocket.close();
                mServerSocket = null;
            }
        } catch(IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Server main loop
     */
    @Override
    public void run() {
        try {
            // Open the server socket
            mServerSocket = new ServerSocket(mPort);
            
            // Loop on accepted connections
            while(true) {
                Socket socket = mServerSocket.accept();
                handle(socket);
            }
        } catch(SocketException e) {
            // Stopped
        } catch(IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Receive an HTTP request and send the response
     */
    private void handle(Socket socket) {
        BufferedReader reader = null;
        PrintStream output = null;
        try {
            reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            output = new PrintStream(socket.getOutputStream());

            // Read request line
            String requestLine = reader.readLine();
            Log.d(TAG, requestLine);

            // Parse request line
            String[] tokens = requestLine.split(" ", 3);
            if(tokens.length != 3) {
                sendResponse(output, "400 Bad Request", false);
                return;
            }
            String method = tokens[0].toUpperCase();
            String route = tokens[1];

            // Read the headers
            Map<String, String> headers = new HashMap<>();
            String line;
            while(!(line = reader.readLine()).isEmpty()) {
                String[] s = line.split(":", 2);
                headers.put(s[0].trim(), (s.length == 2 ? s[1].trim() : ""));
            }

            // Get the content length
            int length = 0;
            if(headers.containsKey("Content-Length"))
                length = Integer.parseInt(headers.get("Content-Length"));

            // Get the content and parse it
            JSONObject content = null;
            if(length > 0)
            {
                char[] buffer = new char[length];
                reader.read(buffer);

                try {
                    content = new JSONObject(new String(buffer));
                } catch(JSONException e) {
                    e.printStackTrace();
                }
            }

            // Handle CORS preflight OPTIONS request
            if(method.equals("OPTIONS")) {
                sendResponse(output, "200 OK", true);
                if(headers.containsKey("Access-Control-Request-Method")) {
                    output.print("Access-Control-Allow-Methods: POST, GET\r\n");
                    output.print("Access-Control-Allow-Headers: Content-Type\r\n");
                }
                else output.print("Allow: POST, GET\r\n");
                output.print("\r\n");
                output.flush();
                return;
            }

            // Process the request
            JSONObject response;
            try {
                response = process(method, route, content);
            } catch(Exception e) {
                e.printStackTrace();
                sendResponse(output, "500 Internal Server Error", false);
                return;
            }

            if(response == null) {
                sendResponse(output, "404 Not Found", false);
                return;
            }

            // Send the response
            byte[] b = response.toString().getBytes();
	        sendResponse(output, "200 OK", true);
            output.print("Content-Type: application/json\r\n");
            output.print("Content-Length: " + b.length + "\r\n");
            output.print("\r\n");
            output.write(b);
            output.flush();
            
        } catch(IOException e) {
            e.printStackTrace();
        } 
        finally {
            try {
                if(output != null) output.close();
                if(reader != null) reader.close();
                socket.close();
            } catch(IOException e) {
                e.printStackTrace();
            }
        }
    }

    /**
     * Send an HTTP response on stream
     */
    private void sendResponse(PrintStream output, String response, boolean otherHeaders) {
        output.print("HTTP/1.1 " + response + "\r\n");
        output.print("Connection: close\r\n");
        output.print("Access-Control-Allow-Origin: *\r\n");	// CORS
        if(!otherHeaders) {
            output.print("\r\n");
            output.flush();
        }
    }

    /**
     * Process a request, should be overridden in subclasses
     */
    public JSONObject process(String method, String route, JSONObject content) throws Exception {
        return null;
    }
}

