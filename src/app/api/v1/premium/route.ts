/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    const url = request.nextUrl.clone();
    url.searchParams.delete("email");
    url.pathname = "/premium-welcome";
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
