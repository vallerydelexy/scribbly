import { IncomingHttpHeaders } from "http"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { Webhook, WebhookRequiredHeaders } from "svix"

import { env } from "@/env.mjs"
import { db } from "@/lib/db"

const webhookSecret = env.CLERK_WEBHOOK_SECRET

async function handler(request: Request) {
  const payload = await request.json()
  const headersList = headers()
  const heads = {
    "svix-id": headersList.get("svix-id"),
    "svix-timestamp": headersList.get("svix-timestamp"),
    "svix-signature": headersList.get("svix-signature"),
  }
  const wh = new Webhook(webhookSecret)
  let evt: Event | null = null

  try {
    evt = wh.verify(
      JSON.stringify(payload),
      heads as IncomingHttpHeaders & WebhookRequiredHeaders
    ) as Event
  } catch (err) {
    console.error((err as Error).message)
    return NextResponse.json({ err: `${err}` }, { status: 400 })
  }

  const eventType: EventType = evt.type
  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, first_name, last_name, email_addresses, image_url } = evt.data
    console.log({ evt: evt.data })
    const existingUser = await db.user.findUnique({
      where: { clerkId: id as string },
    })

    if (existingUser) {
      await db.user.update({
        where: { clerkId: id as string },
        data: {
          name: `${first_name} ${last_name}`,
          email: email_addresses[0].email_address,
          image: image_url as string,
        },
      })
    } else {
      await db.user.create({
        data: {
          clerkId: id as string,
          name: `${first_name} ${last_name}`,
          email: email_addresses[0].email_address,
          image: image_url as string,
        },
      })
    }
  }
  return NextResponse.json({ success: true }, { status: 200 })
}

type EventType = "user.created" | "user.updated" | "*"

type Event = {
  data: Record<string, string | number>
  object: "event"
  type: EventType
}

export const GET = handler
export const POST = handler
export const PUT = handler
