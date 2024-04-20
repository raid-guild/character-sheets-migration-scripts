import migrateCharacters from "./scripts/migrateCharacters";
import migrateClasses from "./scripts/migrateClasses";
import migrateJesterExperience from "./scripts/migrateExperience";

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
    case "migrateJesterExperience":
      await migrateJesterExperience();
      break;
    default:
      console.error("No script to run");
  }

  process.exit();
};

run();
