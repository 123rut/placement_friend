async function run() {
  try {
    const res = await fetch('http://localhost:4000/api');
    console.log(`NestJS Hello status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error connecting to NestJS:', err.message);
  }
}
run();
