import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authenticateCitizenRequest } from '@/lib/authGuard';
import { reverseGeocode } from '@/lib/geocoding';
import { matchJurisdiction } from '@/lib/jurisdictions';
import { validateFrontendRequest, forbiddenResponse } from '@/lib/apiSecurity';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface GeminiAnalysis {
  is_pothole: boolean;
  hazard_type?: string;
  severity: 'Low' | 'Medium' | 'Severe';
  confidence: number;
  reasoning: string;
  estimated_diameter_cm?: number;
}

// Local persistent backup storage path
const BACKUP_DIR = path.join(process.cwd(), 'data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'reports.json');

function saveToLocalBackup(report: any) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    let list: any[] = [];
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
      } catch {
        list = [];
      }
    }
    list.unshift(report);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[Local Backup Notice]', err.message);
  }
}

/**
 * POST /api/verify
 * Accepts multipart form data with image, coordinates, and optional note.
 * Runs Gemini Vision analysis, reverse geocodes the coordinates to a street address,
 * matches the responsible municipal engineering division, uploads the photo,
 * and saves the report to Supabase + sends email notification.
 */
export async function POST(req: NextRequest) {
  try {
    // 0. Enforce strict frontend client security
    const secCheck = validateFrontendRequest(req);
    if (!secCheck.authorized) {
      return forbiddenResponse(secCheck.reason);
    }

    // 1. Strictly enforce citizen authentication: ONLY signed-in citizens can upload/report
    const authResult = await authenticateCitizenRequest(req);
    if (!authResult.success) {
      return authResult.response;
    }

    const { userId, userName } = authResult.context;

    // Parse form data
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);
    const accuracy = parseFloat(formData.get('accuracy') as string) || null;
    const note = (formData.get('note') as string) || '';

    if (!imageFile) {
      return Response.json(
        { error: 'No image provided. Please capture a photo of the road hazard.' },
        { status: 400 }
      );
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return Response.json(
        { error: 'Invalid coordinates. Please enable location services or use the map pin picker.' },
        { status: 400 }
      );
    }

    // Convert image to base64 for Gemini
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    // ── Step 1: Strict Forensic AI Analysis with Gemini Vision ──
    let analysis: GeminiAnalysis = {
      is_pothole: false,
      hazard_type: 'invalid_subject',
      severity: 'Medium',
      confidence: 0,
      reasoning: 'Image could not be verified as a genuine road hazard.',
      estimated_diameter_cm: 25,
    };

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json(
        { error: 'Gemini AI verification service is not configured. Missing GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    // Primary vision model
    const models = ['gemini-2.5-flash'];
    let geminiSuccess = false;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
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
- Estimate the diameter in centimeters: "estimated_diameter_cm" (e.g. 15, 30, 60, 100).
- Set "confidence" between 0.70 and 1.0 reflecting true certainty.

Severity classification (ONLY if is_pothole is true):
- "Low": Minor surface raveling, superficial cracks (<2cm deep), shallow wear.
- "Medium": Typical pothole (5-15cm deep, 15-40cm wide), loose aggregate.
- "Severe": Deep crater (>15cm deep or >40cm wide), exposed base course, tire-puncture or suspension risk.

Return ONLY valid JSON matching:
{
  "is_pothole": true or false,
  "hazard_type": "pothole" | "crater" | "severe_fissure" | "subsidence" | "invalid_subject",
  "confidence": number between 0.0 and 1.0,
  "severity": "Low" | "Medium" | "Severe",
  "estimated_diameter_cm": number,
  "reasoning": "A concise technical sentence describing the road damage, OR an explicit explanation of why it was rejected."
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
              estimated_diameter_cm: Number(parsed.estimated_diameter_cm) || 25,
              reasoning: String(parsed.reasoning || (isPothole ? 'Road surface damage detected.' : 'Not a road hazard.')),
            };
            geminiSuccess = true;
            break;
          }
        } else {
          const errBody = await geminiResponse.text();
          console.warn(`[Gemini API Error ${geminiResponse.status}]:`, errBody);
        }
      } catch (err: any) {
        console.warn(`[Gemini ${model} Attempt Failed]:`, err.message);
      }
    }

    if (!geminiSuccess) {
      return Response.json(
        { error: 'AI analysis service temporarily unavailable. Please try again in a moment.' },
        { status: 502 }
      );
    }

    // ── Step 2: Strictly Reject Non-Road Hazards ──
    if (!analysis.is_pothole) {
      const rejectReason = analysis.reasoning
        ? analysis.reasoning.startsWith('Rejected:')
          ? analysis.reasoning
          : `Rejected by AI: ${analysis.reasoning}`
        : 'Rejected by AI: No genuine road pothole or asphalt hazard detected in this photo. Only clear photos of real road damage are accepted.';

      return Response.json(
        {
          error: rejectReason,
          analysis,
        },
        { status: 400 }
      );
    }

    // ── Step 3: Real Reverse Geocoding & Municipal Ward Jurisdiction ──
    const [humanAddress, jurisdiction] = await Promise.all([
      reverseGeocode(latitude, longitude),
      Promise.resolve(matchJurisdiction(latitude, longitude)),
    ]);

    // ── Step 4: Upload image to Supabase Storage with bucket auto-provisioning ──
    let imageUrl: string;
    const ext = mimeType.split('/')[1] || 'jpg';
    const fileName = `pothole-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    try {
      let { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('potholes')
        .upload(fileName, imageBuffer, {
          contentType: mimeType,
          cacheControl: '31536000',
          upsert: false,
        });

      // If bucket does not exist, auto-create it and retry upload
      if (uploadError && uploadError.message?.toLowerCase().includes('bucket not found')) {
        await supabaseAdmin.storage.createBucket('potholes', { public: true });
        const retry = await supabaseAdmin.storage
          .from('potholes')
          .upload(fileName, imageBuffer, {
            contentType: mimeType,
            cacheControl: '31536000',
            upsert: false,
          });
        uploadData = retry.data;
        uploadError = retry.error;
      }

      if (uploadError || !uploadData) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from('potholes')
        .getPublicUrl(uploadData.path);

      imageUrl = urlData.publicUrl;
    } catch (storageError) {
      console.warn('[Storage Notice] Falling back to high-fidelity Base64 URI:', storageError);
      imageUrl = `data:${mimeType};base64,${base64Image}`;
    }

    // ── Step 5: Insert Report into Supabase PostgreSQL Database ──
    const reportPayload = {
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: userName,
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
      
      // Geospatial & Ward Routing fields
      address: humanAddress,
      ward: jurisdiction.wardName,
      assigned_zone: jurisdiction.zoneName,
      assigned_office: jurisdiction.officeName,
      estimated_diameter_cm: analysis.estimated_diameter_cm || 25,
    };

    let finalReport = reportPayload;

    try {
      const { data: dbReport, error: dbError } = await supabaseAdmin
        .from('reports')
        .insert(reportPayload)
        .select()
        .single();

      if (dbError) {
        console.error('[DB Insert Notice]', dbError.message);
        // Fallback: save to local backup disk
        saveToLocalBackup(reportPayload);
      } else if (dbReport) {
        finalReport = dbReport;
      }
    } catch (err: any) {
      console.error('[DB Connection Notice]', err.message);
      saveToLocalBackup(reportPayload);
    }

    // ── Step 6: Send Rich Email Notification via Resend ──
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
            subject: `🚨 [${analysis.severity} Hazard] ${humanAddress} (${jurisdiction.wardName})`,
            html: `
              <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 540px; margin: 0 auto; background: #09090b; color: #f4f4f5; padding: 24px; border-radius: 16px; border: 1px solid #27272a;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                  <h1 style="font-size: 20px; font-weight: 800; margin: 0; color: #a3e635;">🛣️ Forge Civic Alert</h1>
                  <span style="background: ${analysis.severity === 'Severe' ? '#dc2626' : analysis.severity === 'Medium' ? '#d97706' : '#059669'}; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;">
                    ${analysis.severity.toUpperCase()}
                  </span>
                </div>
                <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 16px;">
                  New road hazard reported by <strong>${userName}</strong>
                </p>
                <div style="background: #18181b; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #27272a;">
                  <table style="width: 100%; font-size: 13px; color: #d4d4d8; border-collapse: collapse;">
                    <tr><td style="padding: 6px 0; color: #71717a;">Location</td><td style="padding: 6px 0; font-weight: 600; color: #fff;">${humanAddress}</td></tr>
                    <tr><td style="padding: 6px 0; color: #71717a;">Ward / Division</td><td style="padding: 6px 0; color: #38bdf8;">${jurisdiction.wardName} (${jurisdiction.zoneName})</td></tr>
                    <tr><td style="padding: 6px 0; color: #71717a;">Responsible Office</td><td style="padding: 6px 0;">${jurisdiction.officeName}</td></tr>
                    <tr><td style="padding: 6px 0; color: #71717a;">Coordinates</td><td style="padding: 6px 0; font-family: monospace;">${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E</td></tr>
                    <tr><td style="padding: 6px 0; color: #71717a;">AI Assessment</td><td style="padding: 6px 0;">${analysis.reasoning}</td></tr>
                    <tr><td style="padding: 6px 0; color: #71717a;">Est. Diameter</td><td style="padding: 6px 0;">~${analysis.estimated_diameter_cm || 25} cm</td></tr>
                  </table>
                </div>
                <a href="https://www.google.com/maps?q=${latitude},${longitude}" style="display: block; text-align: center; padding: 12px; background: linear-gradient(135deg, #a3e635, #10b981); color: #000; font-weight: 800; font-size: 13px; border-radius: 10px; text-decoration: none; margin-bottom: 12px;">
                  📍 Open Live GPS in Google Maps
                </a>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('[Email Dispatch Error]', emailError);
      }
    }

    return Response.json(
      {
        report: finalReport,
        analysis,
        jurisdiction,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Verify API Fatal Error]', error);
    return Response.json(
      { error: error?.message || 'An unexpected server error occurred.' },
      { status: 500 }
    );
  }
}
