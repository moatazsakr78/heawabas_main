// Simplified toast hook
import { useState, useEffect } from 'react'

export type ToastProps = {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export function toast(props: ToastProps) {
  // This is a simplified implementation
  // In a real app, you'd use a context provider
  console.log(`Toast: ${props.type} - ${props.message}`)
  
  // For demo purposes, we'll just use alert
  const icon = props.type === 'success' ? '✓' : 
               props.type === 'error' ? '✗' : 
               props.type === 'warning' ? '⚠' : 'ℹ'
               
  alert(`${icon} ${props.message}`)
} 