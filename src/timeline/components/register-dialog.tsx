'use client';

import * as React from 'react';

// Authentication has been removed. This dialog is no longer used.
export function RegisterDialog({ isOpen, onOpenChange }: {isOpen: boolean, onOpenChange: (isOpen: boolean) => void}) {
  React.useEffect(() => {
    if (isOpen) {
      onOpenChange(false);
    }
  }, [isOpen, onOpenChange]);
  
  return null;
}
