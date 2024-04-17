import { MongoClient } from "mongodb";
import { MONGODB_URI, MONGODB_DATABASE } from "@/utils/constants";

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env"
  );
}

if (!MONGODB_DATABASE) {
  throw new Error(
    "Please define the MONGODB_DATABASE environment variable inside .env"
  );
}

const createClientPromise = async (): Promise<MongoClient> => {
  const client = new MongoClient(MONGODB_URI);
  return client.connect();
};

const clientPromise = createClientPromise();
export const dbPromise = clientPromise.then((client) =>
  client.db(MONGODB_DATABASE)
);
