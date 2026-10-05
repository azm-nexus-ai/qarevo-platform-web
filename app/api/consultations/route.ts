import { createMeeting } from "@/lib/api";
import { NextResponse } from "next/server";

function getNowISO() {
    return new Date().toISOString();
}

function getEndTimeISO(hoursFromNow: number) {
    const d = new Date();
    d.setHours(d.getHours() + hoursFromNow);
    return d.toISOString();
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const patientId = body.patient_id;
        const providerId = body.provider_id;

        if (!patientId || !providerId) {
            return NextResponse.json({ error: "patient_id and provider_id are required" }, { status: 400 });
        }

        const now = getNowISO();
        const endAt = getEndTimeISO(2);

        const response = await createMeeting({
            patient_id: patientId,
            provider_ids: [providerId],
            scheduled_at: now,
            start_at: now,
            end_at: endAt,
        });


        return NextResponse.json(response);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create meeting";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
