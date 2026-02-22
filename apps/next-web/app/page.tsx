import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CLARITY Job Seeker</h1>
      <p>MVP skeleton. Start here:</p>
      <ul>
        <li>
          <Link href="/login">/login</Link>
        </li>
        <li>
          <Link href="/dashboard">/dashboard</Link>
        </li>
      </ul>
    </main>
  );
}

