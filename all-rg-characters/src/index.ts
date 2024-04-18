import migrateCharacters from "./scripts/migrateCharacters";
import migrateClasses from "./scripts/migrateClasses";

// # XP MIGRATION
// 1. Get the XP of all characters
// 2. Get all XP transactions that came in batches of 50
// 3. Subtract all 50 XP transactions from each character's general XP
// 4. Use the 50 XP transactions to give jester class XP to characters

// # ITEM MIGRATION
// Skip

const run = async () => {
  const scriptToRun = process.argv[2];
  console.log("Running script:", scriptToRun);

  switch (scriptToRun) {
    case "migrateCharacters":
      await migrateCharacters();
      break;
    case "migrateClasses":
      await migrateClasses();
      break;
    default:
      console.error("No script to run");
  }

  process.exit();
};

run();
