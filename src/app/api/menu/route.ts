import { NextResponse } from 'next/server';
import { db, persistDb } from '@/lib/serverDb';
import { pushLiveUpdateToGoogleWorkspace } from '@/lib/googleWorkspaceSync';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json(db.menuCategories || [], { 
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
    } 
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, malayalamName, category, priceInr, pricePaise, currentStock, station, dietary, image } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400, headers: corsHeaders });
    }

    const calculatedPricePaise = pricePaise !== undefined 
      ? Number(pricePaise) 
      : Math.round(Number(priceInr || 0) * 100);

    if (isNaN(calculatedPricePaise) || calculatedPricePaise < 0) {
      return NextResponse.json({ error: 'Valid price (₹0 or greater) is required' }, { status: 400, headers: corsHeaders });
    }

    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'Menu category is required. Please select or enter a valid category.' }, { status: 400, headers: corsHeaders });
    }

    const categoryName = category.trim();
    let targetCat = db.menuCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!targetCat) {
      targetCat = {
        id: `cat-${Date.now()}`,
        name: categoryName,
        malayalamName: categoryName,
        items: [],
      };
      db.menuCategories.push(targetCat);
    }

    const newItem: any = {
      id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      malayalamName: (malayalamName || '').trim(),
      pricePaise: calculatedPricePaise,
      isAvailable: true,
      currentStock: currentStock !== null && currentStock !== undefined && currentStock !== '' ? Number(currentStock) : null,
      station: station || 'Main Kitchen',
      dietary: dietary || 'SEAFOOD',
      image: image || '',
      category: targetCat.name,
    };

    targetCat.items.push(newItem);

    // Save state to disk immediately
    persistDb();
    pushLiveUpdateToGoogleWorkspace().catch(() => {});

    // Audit log entry
    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: 'MENU_ITEM_ADDED',
      module: 'MENU',
      usernameSnapshot: 'Menu Manager',
      reason: `Added new dish "${newItem.name}" to ${targetCat.name} for ₹${(newItem.pricePaise / 100).toFixed(2)}`,
      success: true,
    });

    return NextResponse.json({ success: true, item: newItem, categories: db.menuCategories }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (Array.isArray(body.categories)) {
      db.menuCategories = body.categories;
      persistDb();
      pushLiveUpdateToGoogleWorkspace().catch(() => {});
      return NextResponse.json({ success: true, categories: db.menuCategories }, { headers: corsHeaders });
    }
    return NextResponse.json({ error: 'categories must be an array' }, { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { itemId, isAvailable, currentStock, pricePaise, reason } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400, headers: corsHeaders });
    }

    let updatedItem: any = null;
    for (const cat of db.menuCategories) {
      const it = cat.items.find((item) => item.id === itemId);
      if (it) {
        if (typeof isAvailable === 'boolean') it.isAvailable = isAvailable;
        if (currentStock !== undefined) {
          it.currentStock = currentStock !== null && currentStock !== '' ? Number(currentStock) : null;
          if (it.currentStock === 0) {
            it.isAvailable = false;
          } else if (typeof it.currentStock === 'number' && it.currentStock > 0 && typeof isAvailable !== 'boolean') {
            it.isAvailable = true;
          }
        }
        if (pricePaise !== undefined) it.pricePaise = pricePaise;
        updatedItem = it;
        break;
      }
    }

    if (!updatedItem) {
      return NextResponse.json({ error: 'Item not found in live menu' }, { status: 404, headers: corsHeaders });
    }

    // Save state to disk immediately
    persistDb();
    pushLiveUpdateToGoogleWorkspace().catch(() => {});

    // Add audit log entry
    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: pricePaise !== undefined ? 'MENU_PRICE_CHANGED' : 'MENU_AVAILABILITY_CHANGED',
      module: 'MENU',
      usernameSnapshot: 'Menu Manager',
      reason: reason || `Updated item ${updatedItem.name}`,
      success: true,
    });

    return NextResponse.json({ success: true, item: updatedItem }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const categoryId = searchParams.get('categoryId');

    if (categoryId) {
      const idx = db.menuCategories.findIndex((c) => c.id === categoryId || c.name.toLowerCase() === categoryId.toLowerCase());
      if (idx !== -1) {
        const deletedCat = db.menuCategories.splice(idx, 1)[0];
        persistDb();
        pushLiveUpdateToGoogleWorkspace().catch(() => {});
        return NextResponse.json({ success: true, deletedCategory: deletedCat.name, categories: db.menuCategories }, { headers: corsHeaders });
      }
      return NextResponse.json({ error: 'Category not found' }, { status: 404, headers: corsHeaders });
    }

    if (!itemId) {
      return NextResponse.json({ error: 'itemId or categoryId query param is required' }, { status: 400, headers: corsHeaders });
    }

    let deletedName = '';
    for (const cat of db.menuCategories) {
      const idx = cat.items.findIndex((it) => it.id === itemId);
      if (idx !== -1) {
        deletedName = cat.items[idx].name;
        cat.items.splice(idx, 1);
        break;
      }
    }

    // Filter out categories that are now empty
    db.menuCategories = db.menuCategories.filter((c) => c.items.length > 0);

    persistDb();
    pushLiveUpdateToGoogleWorkspace().catch(() => {});

    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: 'MENU_ITEM_DELETED',
      module: 'MENU',
      usernameSnapshot: 'Menu Manager',
      reason: `Deleted dish "${deletedName}"`,
      success: true,
    });

    return NextResponse.json({ success: true, deletedName, categories: db.menuCategories }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
