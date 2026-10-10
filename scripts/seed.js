#!/usr/bin/env node
/**
 * CampusPulse Demo Seed Script
 * 
 * Seeds 5 realistic campus issues into the live API.
 * Run this ONCE after deploying to populate demo data.
 * 
 * Usage:
 *   node seed.js <API_BASE_URL>
 *   
 * Example:
 *   node seed.js https://abc123.execute-api.us-east-1.amazonaws.com/prod
 */

const apiBase = process.argv[2];

if (!apiBase) {
  console.error('Usage: node seed.js <API_BASE_URL>');
  console.error('Example: node seed.js https://abc123.execute-api.us-east-1.amazonaws.com/prod');
  process.exit(1);
}

const demoIssues = [
  {
    title: 'Wi-Fi Dead Zone in Main Library Reading Room',
    description: 'The Wi-Fi signal is completely absent in the main library reading room (3rd floor), making it impossible to access online resources or submit assignments. This has been ongoing since last Monday and affects approximately 50+ students daily during peak hours.',
    category: 'wifi',
    location: 'Main Library - 3rd Floor Reading Room',
    priority: 'high',
    reporterName: 'Alex Chen',
    isDemoData: true,
  },
  {
    title: 'Projector Malfunctioning in CS Lecture Hall B',
    description: 'The projector in CS Lecture Hall B (Building C, Room 204) has been showing a black screen for the past three days. Professors cannot display slides, seriously disrupting lectures for approximately 120 students enrolled in CS101 and CS201.',
    category: 'classroom_equipment',
    location: 'CS Building - Lecture Hall B, Room 204',
    priority: 'critical',
    reporterName: 'Priya Sharma',
    isDemoData: true,
  },
  {
    title: 'Water Leak in Boys Hostel Block D Bathroom',
    description: 'There is a persistent water leak in the 2nd floor bathroom of Boys Hostel Block D. Water has been dripping from the ceiling near the sink area, creating a slipping hazard and possible structural damage if not addressed promptly.',
    category: 'plumbing',
    location: 'Boys Hostel - Block D, 2nd Floor Bathroom',
    priority: 'high',
    reporterName: 'Rahul Patel',
    isDemoData: true,
  },
  {
    title: 'Flickering Lights in Engineering Lab 3',
    description: 'The overhead fluorescent lights in Engineering Lab 3 have been flickering intermittently for two weeks. This causes eye strain during extended lab sessions and could indicate an electrical fault. Some students with photosensitivity have reported headaches.',
    category: 'electrical',
    location: 'Engineering Block - Lab 3, Ground Floor',
    priority: 'medium',
    reporterName: 'Sarah Johnson',
    isDemoData: true,
  },
  {
    title: 'Found: MacBook Pro Left in Cafeteria',
    description: 'A MacBook Pro (13-inch, silver) was found unattended at Table 7 in the main cafeteria at approximately 2:30 PM. The device has a blue sticker on the back. It has been handed to the security desk at the main entrance. Owner should bring proof of purchase to claim.',
    category: 'lost_found',
    location: 'Main Cafeteria - Table 7 (handed to Security Desk)',
    priority: 'low',
    reporterName: 'Campus Security',
    isDemoData: true,
  },
];

async function seedIssue(issue) {
  const url = `${apiBase.replace(/\/$/, '')}/issues`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  console.log(`\n🌱 CampusPulse Demo Data Seed Script`);
  console.log(`📡 API: ${apiBase}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // First, check health
  try {
    const healthRes = await fetch(`${apiBase.replace(/\/$/, '')}/health`);
    const health = await healthRes.json();
    console.log(`✅ API Health: ${health.status} (${health.timestamp})\n`);
  } catch (err) {
    console.error(`❌ Cannot reach API at ${apiBase}`);
    console.error(`   Error: ${err.message}`);
    console.error(`   Make sure the backend is deployed and API_BASE_URL is correct.`);
    process.exit(1);
  }

  let succeeded = 0;
  let failed = 0;

  for (const issue of demoIssues) {
    process.stdout.write(`  Creating: "${issue.title.substring(0, 50)}..."  `);
    try {
      const result = await seedIssue(issue);
      console.log(`✅ ID: ${result.issue.id.substring(0, 8)}...`);
      succeeded++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ ${succeeded} issues created successfully`);
  if (failed > 0) console.log(`❌ ${failed} issues failed`);
  console.log(`\n🎯 Open the frontend to verify: ${apiBase.replace('/prod', '')}\n`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
