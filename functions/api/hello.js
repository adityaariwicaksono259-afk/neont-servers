export async function onRequestGet(context) {
  return new Response(JSON.stringify({ 
    ok: true, 
    message: "NEONT Server is running!",
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
