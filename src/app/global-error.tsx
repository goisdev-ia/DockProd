'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset?: () => void
}) {
  const handleReset = () => {
    if (typeof reset === 'function') {
      reset()
    } else {
      window.location.reload()
    }
  }

  return (
    <html lang="pt-BR">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
          <h2 className="text-2xl font-bold">Algo deu errado!</h2>
          <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
