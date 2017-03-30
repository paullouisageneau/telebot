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

import org.json.JSONObject;

public class SerialHttpServer extends HttpServer {

    private SerialHandler mHandler;
    private int mLeft, mRight;

    public SerialHttpServer(int port, SerialHandler handler) {
        super(port);
        mHandler = handler;
        mHandler.setControl(0, 0);
        mLeft = 0;
        mRight = 0;
    }

    @Override
    public void start()
    {
        super.start();
    }

    @Override
    public void stop()
    {
        super.stop();
        mHandler.close();
    }

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
