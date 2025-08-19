// server.js - optional launcher to keep cron schedules alive in the same process
import './cron/auto-post.mjs';
console.log('Cron schedules loaded (Mon & Thu at 09:00). Start your Astro server separately or via a process manager.');