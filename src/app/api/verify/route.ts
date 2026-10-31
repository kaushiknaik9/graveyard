import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authenticateRequest } from '@/lib/serverAuth';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

interface GeminiAnalysis {
  is_pothole: boolean;
  hazard_type?: string;
  severity: 'Low' | 'Medium' | 'Severe';
  confidence: number;
  reasoning: string;
}

/**
 * POST /api/verify
 * Accepts multipart form data with image, coordinates, and optional note.
 * Requires valid Supabase Auth session token.
 * Runs strict AI analysis, uploads image, creates report, and sends email alert.
 */
export async function POST(req: NextRequest) {
  try {
    // ── Security Check: Verify Supabase Session ──
    const auth = await authenticateRequest(req);
    if (auth.status !== 200 || !auth.user) {
      return Response.json(
        { error: auth.error || 'Unauthorized. Valid login session is required to report road hazards.' },
        { status: auth.status }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);
    const accuracy = parseFloat(formData.get('accuracy') as string) || null;
    const note = (formData.get('note') as string) || '';

    // Trust only server-verified user identity
    const verifiedUserId = auth.user.id;
    const verifiedUserName =
      auth.user.user_metadata?.user_name ||
      auth.user.email?.split('@')[0] ||
      'Citizen Reporter';

    if (!imageFile) {
      return Response.json(
        { error: 'No image provided. Please capture a photo of the road hazard.' },
        { status: 400 }
      );
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return Response.json(
        { error: 'Invalid coordinates. Please enable location services and try again.' },
        { status: 400 }
      );
    }

    // Convert image to base64 for Gemini
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    // ── Step 1: Strict Forensic AI Analysis with Gemini Vision ──
    // Default to false to guarantee non-road and fraudulent photos are strictly rejected
    let analysis: GeminiAnalysis = {
      is_pothole: false,
      hazard_type: 'invalid_subject',
      severity: 'Medium',
      confidence: 0,
      reasoning: 'Image could not be verified as a genuine road hazard.',
    };

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json(
        { error: 'Gemini AI verification service is not configured. Missing GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an expert forensic road inspector and safety auditor for a Municipal Department of Transportation.
Your single mandate is to strictly verify whether this photo shows a GENUINE ROADWAY HAZARD (pothole, asphalt crater, severe road subsidence, road surface collapse, or dangerous asphalt fissure) on an outdoor public street, highway, or paved road.

STRICT ANTI-FRAUD / ANTI-BULLSHIT POLICY:
You MUST set "is_pothole": false and "hazard_type": "invalid_subject" for ANY of the following:
1. People, selfies, faces, bodies, hands, clothing, or pets/animals.
2. Indoor scenes: interior rooms, tile floors, wooden flooring, carpet, walls, furniture, or ceilings.
3. Food, drinks, household objects, desk items, electronics, screens, or paper documents.
4. Clean, smooth, undamaged asphalt, normal painted road markings with no holes, or undamaged pavement.
5. Grass lawns, gardens, trees, sky, dirt hiking trails, or nature scenes with no paved road hazard.
6. Memes, cartoons, screenshots, drawings, text, or non-photographic graphics.
7. Vehicles (cars, bikes, motorcycles) unless an obvious asphalt crater is clearly visible under or around them.
8. Blurry, dark, or unrecognizable photos where the road surface structure cannot be verified.

CRITERIA FOR ACCEPTANCE ("is_pothole": true):
- The image MUST clearly show an outdoor paved road, street, or highway (asphalt, bitumen, or concrete).
- There MUST be an actual physical hole, cavity, depression, broken edge, or structural crack in the road surface that poses a safety hazard.
- Set "hazard_type" to one of: "pothole", "crater", "severe_fissure", "subsidence".
- Set "confidence" between 0.70 and 1.0 reflecting true certainty.

Severity classification (ONLY if is_pothole is true):
- "Low": Minor surface raveling, superficial cracks (<2cm deep), shallow wear.
- "Medium": Typical pothole (5-15cm deep), loose aggregate, broken asphalt chunking.
- "Severe": Deep crater (>15cm deep), exposed subsurface/base course, severe tire-puncture or suspension risk.

Return ONLY valid JSON (no markdown formatting, no code fences):
{
  "is_pothole": true or false,
  "hazard_type": "pothole" | "crater" | "severe_fissure" | "subsidence" | "invalid_subject",
  "confidence": number between 0.0 and 1.0,
  "severity": "Low" | "Medium" | "Severe",
  "reasoning": "A concise technical sentence describing the road damage, OR an explicit explanation of why it was rejected (e.g., 'Rejected: Photo shows a selfie/person, not road damage' or 'Rejected: Image displays indoor tile flooring, not an outdoor road hazard' or 'Rejected: Road surface appears smooth and undamaged with no pothole')."
}`,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      });

      if (geminiResponse.ok) {
        const geminiJson = await geminiResponse.json();
        const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed: any = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        }

        if (parsed) {
          const isPothole =
            Boolean(parsed.is_pothole) === true &&
            parsed.hazard_type !== 'invalid_subject';

          analysis = {
            is_pothole: isPothole,
            hazard_type: parsed.hazard_type || (isPothole ? 'pothole' : 'invalid_subject'),
            severity: ['Low', 'Medium', 'Severe'].includes(parsed.severity) ? parsed.severity : 'Medium',
            confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.85)),
            reasoning: String(parsed.reasoning || (isPothole ? 'Road surface damage detected.' : 'Not a road hazard.')),
          };
        }
      } else {
        const errText = await geminiResponse.text().catch(() => '');
        console.error('[Gemini API Error Response]', geminiResponse.status, errText);
        return Response.json(
          { error: 'Gemini AI service error. Please verify the Gemini API key or try again in a few moments.' },
          { status: 502 }
        );
      }
    } catch (geminiError: any) {
      console.error('[Gemini Verification Error]', geminiError);
      return Response.json(
        { error: 'Failed to communicate with Gemini Vision AI. Please check network connection.' },
        { status: 502 }
      );
    }

    // ── Step 2: Strictly Reject Non-Road Hazards / Bullshit ──
    if (!analysis.is_pothole) {
      const rejectReason = analysis.reasoning
        ? analysis.reasoning.startsWith('Rejected:')
          ? analysis.reasoning
          : `Rejected by AI: ${analysis.reasoning}`
        : 'Rejected by AI: No genuine road pothole or asphalt hazard detected in this photo. Only clear photos of real road damage on streets or highways are accepted.';

      return Response.json(
        {
          error: rejectReason,
          analysis,
        },
        { status: 400 }
      );
    }

    // ── Step 3: Upload image to Supabase Storage with fallback ──
    let imageUrl: string;
    const fileName = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${mimeType.split('/')[1] || 'jpg'}`;

    try {
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('potholes')
        .upload(fileName, imageBuffer, {
          contentType: mimeType,
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from('potholes')
        .getPublicUrl(uploadData.path);

      imageUrl = urlData.publicUrl;
    } catch (storageError) {
      console.warn('[Storage Notice] Falling back to high-fidelity Base64 data URI (Bucket not initialized yet)');
      // Always guarantee the photo renders cleanly
      imageUrl = `data:${mimeType};base64,${base64Image}`;
    }

    // ── Step 4: Insert report into Supabase PostgreSQL ──
    const reportPayload = {
      id: crypto.randomUUID(),
      user_id: verifiedUserId,
      user_name: verifiedUserName,
      image_url: imageUrl,
      latitude,
      longitude,
      accuracy_meters: accuracy,
      severity: analysis.severity,
      ai_confidence: analysis.confidence,
      ai_reasoning: note ? `${analysis.reasoning} | Note: ${note}` : analysis.reasoning,
      status: 'Pending' as const,
      upvotes: 0,
      created_at: new Date().toISOString(),
    };

    const { data: dbReport, error: dbError } = await supabaseAdmin
      .from('reports')
      .insert(reportPayload)
      .select()
      .single();

    if (dbError) {
      console.error('[DB Insert Error]', dbError);
      return Response.json(
        { error: 'Failed to record report in database. Please try again.' },
        { status: 500 }
      );
    }

    const finalReport = dbReport || reportPayload;

    // ── Step 5: Send email notification via Resend ──
    const resendKey = process.env.RESEND_API_KEY;
    const govEmail = process.env.DEFAULT_GOV_ALERT_EMAIL;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    if (resendKey && govEmail) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: govEmail,
            subject: `🚨 Road Hazard Alert — ${analysis.severity} Severity`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; background: #09090b; color: #fff; padding: 24px; border-radius: 16px;">
                <h1 style="font-size: 20px; margin: 0 0 4px;">🛣️ Forge Civic Alert</h1>
                <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 20px;">New road hazard reported by ${verifiedUserName}</p>
                <div style="background: #18181b; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                  <table style="width: 100%; font-size: 13px; color: #d4d4d8;">
                    <tr><td style="padding: 4px 0; color: #71717a;">Severity</td><td style="padding: 4px 0; font-weight: 700; color: ${analysis.severity === 'Severe' ? '#f87171' : analysis.severity === 'Medium' ? '#fbbf24' : '#34d399'};">${analysis.severity}</td></tr>
                    <tr><td style="padding: 4px 0; color: #71717a;">Confidence</td><td style="padding: 4px 0;">${Math.round(analysis.confidence * 100)}%</td></tr>
                    <tr><td style="padding: 4px 0; color: #71717a;">Location</td><td style="padding: 4px 0;">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</td></tr>
                    <tr><td style="padding: 4px 0; color: #71717a;">AI Analysis</td><td style="padding: 4px 0;">${analysis.reasoning}</td></tr>
                  </table>
                </div>
                <a href="https://www.google.com/maps?q=${latitude},${longitude}" style="display: block; text-align: center; padding: 12px; background: linear-gradient(135deg, #a3e635, #10b981); color: #000; font-weight: 700; font-size: 13px; border-radius: 10px; text-decoration: none;">
                  📍 View on Google Maps
                </a>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('[Email Error]', emailError);
      }
    }

    // ── Step 6: Return 201 Created ──
    return Response.json(
      { report: finalReport, analysis },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Verify API Error]', error);
    return Response.json(
      { error: error?.message || 'An unexpected server error occurred.' },
      { status: 500 }
    );
  }
}
