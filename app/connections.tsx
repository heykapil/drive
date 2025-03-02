'use client'

import { Button } from '@/components/ui/button'
import { testConnectionsAction } from '@/lib/actions'
export function TestButton() {
  return <Button onClick={() => testConnectionsAction()}>Test</Button>
}
