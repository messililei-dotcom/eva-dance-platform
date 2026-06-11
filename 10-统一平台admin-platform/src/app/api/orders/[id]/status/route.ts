import { NextRequest, NextResponse } from 'next/server';

// Mock order data (since modules were removed)
const mockOrders: Record<string, any> = {};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const body = await request.json();
    const { toStatus } = body;
    if (!toStatus) return NextResponse.json({ error: '缺少目标状态' }, { status: 400 });
    return NextResponse.json({ id: routeParams.id, status: toStatus, updated: true });
  } catch (error) {
    return NextResponse.json({ error: '更新订单状态失败' }, { status: 500 });
  }
}
