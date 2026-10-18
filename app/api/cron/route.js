import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(request) {
  // 1. Cron secret ellenőrzés
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Apify hívás
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID;

  if (!token || !actorId) {
    return NextResponse.json(
      { error: 'Hiányzó APIFY_TOKEN vagy APIFY_ACTOR_ID' },
      { status: 500 }
    );
  }

  const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`;

  // A bakos_bence/ingatlan-com scraper valós input sémája szerint
  const input = {
    listingType: 'elado',
    location: 'budapest',
    propertyType: 'lakas',
    maxResults: 20
  };

  try {
    const res = await fetch(apifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'Apify hiba', status: res.status, detail: text },
        { status: 500 }
      );
    }

    const items = await res.json();

    // 3. Egyszerűsített kimenet
    const simplified = items.map((item) => ({
      id: item.listingId ?? item.url?.split('/').pop(),
      title: item.listingTitle,
      price: item.price,
      url: item.url,
      district: item.district,
      surface: item.surface
    }));

    return NextResponse.json({
      ok: true,
      count: simplified.length,
      items: simplified.slice(0, 5)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Kivétel', message }, { status: 500 });
  }
}