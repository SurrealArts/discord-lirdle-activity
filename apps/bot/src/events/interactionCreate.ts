import { readdirSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { clog } from '@lirdle/logger';

/**
 * Recursively find all .js interaction handler files in a directory.
 * @param {string} dir - Directory path to search
 * @returns {string[]} Array of file paths
 */
function getInteractionFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = getInteractionFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const interactionFiles = getInteractionFiles('./interactions');

/**
 * Main interaction event handler. Routes slash commands, button clicks, and
 * modal submissions to their corresponding handler files in the interactions/
 * directory. Supports customId routing via colon-delimited (prefix:arg) or
 * underscore-delimited (prefix_action) formats.
 * @param {import('discord.js').Client} client - Discord client instance
 * @param {import('discord.js').Interaction} interaction - The interaction to handle
 */
export default async (client, interaction) => {
  try {
    let fileMatch;

    if (interaction.isChatInputCommand()) {
      fileMatch = interactionFiles.find(
        (file) => path.basename(file) === `${interaction.commandName}.js`,
      );
    } else if (interaction.isButton() || interaction.isModalSubmit()) {
      // support customId formats:
      //  - prefix_action      -> maps to interactions/prefix_action.js
      //  - prefix:arg1:arg2   -> maps to interactions/prefix.js  (first segment is handler name)
      let fileBase = '';
      if (typeof interaction.customId === 'string') {
        if (interaction.customId.includes(':')) {
          // colon format: handler is the first segment
          const parts = interaction.customId.split(':');
          fileBase = parts[0] || '';
        } else if (interaction.customId.includes('_')) {
          // underscore format: handler is full "prefix_action"
          fileBase = interaction.customId;
        } else {
          // fallback: try entire customId as filename
          fileBase = interaction.customId;
        }
      }

      fileMatch = interactionFiles.find((file) => path.basename(file) === `${fileBase}.js`);
    } else {
      // For other types of interactions (TBA);
      return;
    }

    if (!fileMatch) {
      clog(
        console.error,
        `[apps/bot/events/interactionCreate.js] The interaction file was not found for interaction: ${interaction.customId || interaction.commandName}`,
      );
      return;
    }

    const moduleURL = pathToFileURL(fileMatch);
    const { run } = await import(moduleURL.href);
    await run(client, interaction);
  } catch (err) {
    clog(console.error, '[apps/bot/events/interactionCreate.js] Error handling interaction:', err);
  }
};
