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
  const actorId = process.env.APIFY_ACTOR_ID; // pl. bakos_bence~ingatlan-com

  if (!token || !actorId) {
    return NextResponse.json({ error: 'Hiányzó APIFY_TOKEN vagy APIFY_ACTOR_ID' }, { status: 500 });
  }

  const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

  const input = {
    // Ezeket a mezőket a scraper input sémája szerint kell beállítani!
    // Példa a bakos_bence/ingatlan-com scraperhez:
    city: 'Budapest',
    district: 'XIII. kerület',
    listingType: 'sale',
    propertyType: 'apartment',
    maxPrice: 80000000,
    maxItems: 20
  };

  try {
    const res = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Apify hiba', status: res.status, detail: text }, { status: 500 });
    }

    const items = await res.json();

    // 3. Egyszerűsített kimenet
    const simplified = items.map(item => ({
      id: item.url?.split('/').pop(),
      title: item.listingTitle,
      price: item.price,
      url: item.url,
      district: item.district,
      surface: item.surface
    }));

    return NextResponse.json({
      ok: true,
      count: simplified.length,
      items: simplified.slice(0, 5) // csak az első 5-öt mutatjuk, hogy ne legyen túl nagy a válasz
    });
  } catch (err) {
    return NextResponse.json({ error: 'Kivétel', message: err.message }, { status: 500 });
  }
}