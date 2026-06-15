/**
 * Sheikh's Daily Job Alert System  (widened)
 * Pulls REAL jobs from Remotive's free public API, matches a broad set of
 * roles, EXCLUDES India-restricted listings, and emails a digest with links.
 */

const https = require('https');
const nodemailer = require('nodemailer');

const CONFIG = {
  emailTo: 'sheikhtwaha@gmail.com',
  emailFrom: process.env.GMAIL_USER || 'sheikhtwaha@gmail.com',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',

  keywords: [
    'data center', 'datacenter', 'data centre', 'colocation', 'hyperscale',
    'infrastructure', 'cloud', 'gpu', 'compute', 'network',
    'business development', 'biz dev', 'bizdev', 'commercial', 'go-to-market',
    'gtm', 'growth', 'partnerships', 'partner', 'alliances', 'alliance',
    'sales', 'account executive', 'account manager', 'account director', 'key account',
    'consulting', 'consultant', 'advisory', 'advisor', 'strategy', 'strategic',
    'corporate development', 'transformation',
    'program manager', 'programme manager', 'program management', 'project manager',
    'project management', 'portfolio', 'pmo',
    'operations', 'procurement', 'vendor', 'sourcing',
    'vice president', 'vp ', 'head of', 'chief', 'director', 'manager', 'lead', 'principal'
  ],

  excludeLocations: ['india'],

  maxJobsInEmail: 40
};

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'PersonalJobDigest/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Bad JSON from ' + url + ' (status ' + res.statusCode + ')')); }
      });
    }).on('error', reject);
  });
}

function matchesKeyword(title) {
  const t = (title || '').toLowerCase();
  return CONFIG.keywords.some((k) => t.includes(k));
}

function isExcludedLocation(loc) {
  const l = (loc || '').toLowerCase();
  return CONFIG.excludeLocations.some((x) => l.includes(x));
}

async function fetchJobs() {
  const json = await getJSON('https://remotive.com/api/remote-jobs?limit=500');
  const jobs = (json && json.jobs) || [];
  const matched = [];
  for (const j of jobs) {
    if (matchesKeyword(j.title) && !isExcludedLocation(j.candidate_required_location)) {
      matched.push({
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || 'Remote',
        salary: j.salary || '',
        url: j.url,
        date: (j.publication_date || '').split('T')[0],
        source: 'Remotive'
      });
    }
  }
  return matched;
}

function buildHtml(jobs) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = jobs.map((j, i) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 8px;color:#999;vertical-align:top;">${i + 1}</td>
      <td style="padding:10px 8px;vertical-align:top;">
        <a href="${j.url}" style="color:#1a4d8f;text-decoration:none;font-weight:600;">${j.title}</a><br>
        <span style="color:#555;">${j.company}</span>
        ${j.salary ? `<br><span style="color:#2e7d32;font-size:12px;">${j.salary}</span>` : ''}
      </td>
      <td style="padding:10px 8px;color:#555;vertical-align:top;">${j.location}</td>
      <td style="padding:10px 8px;color:#999;font-size:12px;vertical-align:top;">${j.date || ''}</td>
    </tr>`).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:740px;margin:0 auto;">
    <h2 style="color:#1a4d8f;margin-bottom:4px;">Your Daily Job Matches</h2>
    <p style="color:#777;margin-top:0;">${today}</p>
    <p style="color:#555;">${jobs.length} role(s) matched (India-based roles excluded). Click a title to view and apply.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f4f6f9;text-align:left;">
          <th style="padding:10px 8px;">#</th>
          <th style="padding:10px 8px;">Role / Company</th>
          <th style="padding:10px 8px;">Location</th>
          <th style="padding:10px 8px;">Posted</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#999;font-size:12px;margin-top:18px;">
      Job data via <a href="https://remotive.com" style="color:#999;">Remotive</a> (free public API).
      Listings may be delayed ~24h. Personal automated digest.
    </p>
  </div>`;
}

async function sendEmail(jobs) {
  if (!CONFIG.gmailAppPassword) {
    console.log('\nNo GMAIL_APP_PASSWORD set — printing results instead:\n');
    jobs.forEach((j, i) => console.log(`${i + 1}. ${j.title} — ${j.company} (${j.location})\n   ${j.url}`));
    return;
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: CONFIG.emailFrom, pass: CONFIG.gmailAppPassword }
  });
  await transporter.sendMail({
    from: CONFIG.emailFrom,
    to: CONFIG.emailTo,
    subject: `${jobs.length} job matches — ${new Date().toLocaleDateString('en-GB')}`,
    html: buildHtml(jobs)
  });
  console.log(`Email sent to ${CONFIG.emailTo} with ${jobs.length} jobs.`);
}

async function main() {
  console.log('Fetching real jobs from Remotive...');
  let jobs = await fetchJobs();
  console.log(`Matched ${jobs.length} jobs (after excluding India).`);
  jobs = jobs.slice(0, CONFIG.maxJobsInEmail);
  if (jobs.length === 0) {
    console.log('No matches today — no email sent.');
    return;
  }
  await sendEmail(jobs);
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
