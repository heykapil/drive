import { query } from '@/service/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (process.env.NODE_ENV === 'production' && !session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, parentId } = (await req.json()) as {
      name: string;
      parentId?: number | null;
    };

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Folder name is required.' },
        { status: 400 },
      );
    }

    // Use NULL for top-level folders if parentId is not provided or is null
    const parent = parentId ? Number(parentId) : null;

    const { rows } = await query(
      'INSERT INTO folders (name, parent_id) VALUES ($1, $2) RETURNING id, name, parent_id',
      [name.trim(), parent],
    );

    return NextResponse.json({
      message: 'Folder created successfully.',
      folder: rows[0],
    });
  } catch (error: any) {
    // Handle unique constraint violation (duplicate folder name in the same parent)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A folder with this name already exists in this location.' },
        { status: 409 },
      );
    }
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
