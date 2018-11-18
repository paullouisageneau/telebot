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

import org.json.JSONObject;

/**
 * Specialized HTTP serial to handle control requests
 */
public class SerialHttpServer extends HttpServer {

    private SerialHandler mHandler;
    private int mLeft, mRight;          // Current controls

    /**
     * Create server for specified port and serial handler
     */
    public SerialHttpServer(int port, SerialHandler handler) {
        super(port);
        mHandler = handler;
        mHandler.setControl(0, 0);
        mLeft = 0;
        mRight = 0;
    }

    /**
     * Start the server
     */
    @Override
    public void start()
    {
        super.start();
    }

    /**
     * Stop the server
     */
    @Override
    public void stop()
    {
        super.stop();
        mHandler.close();
    }

    /**
     * Process a control request
     */
    @Override
    public JSONObject process(String method, String route, JSONObject content) throws Exception {

        if(route.equals("/") || route.equals("/control")) {

            if(method.equals("POST") && content != null) {
                mLeft  = content.getInt("left");
                mRight = content.getInt("right");
                mHandler.setControl(mLeft, mRight);
            }

            JSONObject response = new JSONObject();
            response.put("left", mLeft);
            response.put("right", mRight);
            return response;
        }

        return null;
    }
}
