async function run() {
  const userId = '8eacbdf4-62b4-4d8e-8906-286e3e1faee7';
  console.log(`Triggering sync for userId: ${userId}...`);
  try {
    const res = await fetch('http://localhost:4000/api/worker/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    console.log(`Response Status: ${res.status}`);
    const data = await res.json();
    console.log('\nResponse Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error triggering sync:', err);
  }
}

run();
