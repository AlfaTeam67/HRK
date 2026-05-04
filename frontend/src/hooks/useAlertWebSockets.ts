import { useEffect, useRef, useState } from 'react'

export function useAlertWebSockets(userId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!userId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // In dev, the backend is likely at localhost:8000
    // We might need to adjust this depending on the environment
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host
    const socketUrl = `${protocol}//${host}/api/v1/alerts/ws/${userId}`

    const connect = () => {
      console.log('Connecting to WebSocket:', socketUrl)
      const ws = new WebSocket(socketUrl)

      ws.onopen = () => {
        console.log('WebSocket Connected')
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('WebSocket Message Received:', data)
          setLastMessage(data)
        } catch (err) {
          console.error('Failed to parse WS message:', err)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket Disconnected. Retrying in 5s...')
        setIsConnected(false)
        setTimeout(connect, 5000)
      }

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err)
        ws.close()
      }

      socketRef.current = ws
    }

    connect()

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [userId])

  return { isConnected, lastMessage }
}
