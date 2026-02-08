/**
 * Firebase Functions für Cloudinary Bildverwaltung
 * Sichere Schnittstelle zwischen Frontend und Cloudinary
 */

import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {v2 as cloudinary} from "cloudinary";
import corsLib from "cors";
import {defineSecret} from "firebase-functions/params";

// Initialize Firebase Admin
admin.initializeApp();

// CORS Configuration - erlaubt Requests vom Frontend
const cors = corsLib({origin: true});

// Define secrets
const CLOUDINARY_CLOUD_NAME = defineSecret("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");

// Export Admin Claim Function
export {setAdminClaimByUid} from "./setAdminClaimFunction";

// Cloudinary Configuration aus Firebase Secrets
const configureCloudinary = () => {
  const cloudName = CLOUDINARY_CLOUD_NAME.value()?.trim();
  const apiKey = CLOUDINARY_API_KEY.value()?.trim();
  const apiSecret = CLOUDINARY_API_SECRET.value()?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials not configured");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
};

/**
 * Middleware: Prüft ob User ein Admin ist
 */
const verifyAdmin = async (req: any): Promise<string> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Prüfe admin claim
    if (!decodedToken.admin) {
      throw new Error("User is not an admin");
    }

    return decodedToken.uid;
  } catch (error) {
    throw new Error("Invalid authentication token");
  }
};

/**
 * (A) Admin: Liste aller Bilder eines Events (pending + approved)
 * GET /adminListImages?event=<eventSlug>
 */
export const adminListImages = onRequest(
  {
    region: "europe-west1",
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Nur GET erlaubt
        if (req.method !== "GET") {
          res.status(405).json({error: "Method not allowed"});
          return;
        }

        // Admin-Check
        await verifyAdmin(req);

        // Event-Parameter
        const eventSlug = req.query.event as string;
        if (!eventSlug) {
          res.status(400).json({error: "Missing event parameter"});
          return;
        }

        // Cloudinary konfigurieren
        configureCloudinary();

        // Suche nach Bildern im Ordner events/<eventSlug> ODER mit Tag event_<eventSlug>
        // Erlaube sowohl "Fasching 2026" als auch "fasching-2026" Format
        const folderPath = `events/${eventSlug}`;
        const searchExpression = `folder:"${folderPath}" AND resource_type:image`;

        const result = await cloudinary.search
          .expression(searchExpression)
          .sort_by("created_at", "desc")
          .with_field("tags")
          .max_results(500)
          .execute();

        // Formatiere Response
        const images = result.resources.map((img: any) => ({
          public_id: img.public_id,
          secure_url: img.secure_url,
          created_at: img.created_at,
          tags: img.tags || [],
          width: img.width,
          height: img.height,
          approved: img.tags?.includes("approved") || false,
        }));

        res.status(200).json({
          success: true,
          event: eventSlug,
          total: images.length,
          images,
        });
      } catch (error: any) {
        console.error("Error in adminListImages:", error);
        const statusCode = error.message?.includes("admin") ? 403 : 500;
        res.status(statusCode).json({
          error: error.message || "Internal server error",
        });
      }
    });
  }
);

/**
 * (B) Admin: Bilder freigeben
 * POST /adminApproveImages
 * Body: { publicIds: string[] }
 */
export const adminApproveImages = onRequest(
  {
    region: "europe-west1",
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Nur POST erlaubt
        if (req.method !== "POST") {
          res.status(405).json({error: "Method not allowed"});
          return;
        }

        // Admin-Check
        await verifyAdmin(req);

        // Body validieren
        const {publicIds} = req.body;
        if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
          res.status(400).json({error: "Missing or invalid publicIds array"});
          return;
        }

        // Cloudinary konfigurieren
        configureCloudinary();

        // Tag "approved" zu allen Bildern hinzufügen
        const results = await Promise.all(
          publicIds.map((publicId) =>
            cloudinary.uploader.add_tag("approved", [publicId])
          )
        );

        res.status(200).json({
          success: true,
          approved: publicIds.length,
          results,
        });
      } catch (error: any) {
        console.error("Error in adminApproveImages:", error);
        const statusCode = error.message?.includes("admin") ? 403 : 500;
        res.status(statusCode).json({
          error: error.message || "Internal server error",
        });
      }
    });
  }
);

/**
 * (C) Admin: Freigabe entfernen
 * POST /adminUnapproveImages
 * Body: { publicIds: string[] }
 */
export const adminUnapproveImages = onRequest(
  {
    region: "europe-west1",
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Nur POST erlaubt
        if (req.method !== "POST") {
          res.status(405).json({error: "Method not allowed"});
          return;
        }

        // Admin-Check
        await verifyAdmin(req);

        // Body validieren
        const {publicIds} = req.body;
        if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
          res.status(400).json({error: "Missing or invalid publicIds array"});
          return;
        }

        // Cloudinary konfigurieren
        configureCloudinary();

        // Tag "approved" von allen Bildern entfernen
        const results = await Promise.all(
          publicIds.map((publicId) =>
            cloudinary.uploader.remove_tag("approved", [publicId])
          )
        );

        res.status(200).json({
          success: true,
          unapproved: publicIds.length,
          results,
        });
      } catch (error: any) {
        console.error("Error in adminUnapproveImages:", error);
        const statusCode = error.message?.includes("admin") ? 403 : 500;
        res.status(statusCode).json({
          error: error.message || "Internal server error",
        });
      }
    });
  }
);

/**
 * (D) Admin: Bilder löschen
 * POST /adminDeleteImages
 * Body: { publicIds: string[] }
 */
export const adminDeleteImages = onRequest(
  {
    region: "europe-west1",
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Nur POST erlaubt
        if (req.method !== "POST") {
          res.status(405).json({error: "Method not allowed"});
          return;
        }

        // Admin-Check
        await verifyAdmin(req);

        // Body validieren
        const {publicIds} = req.body;
        if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
          res.status(400).json({error: "Missing or invalid publicIds array"});
          return;
        }

        // Cloudinary konfigurieren
        configureCloudinary();

        // Lösche alle Bilder permanent
        const results = await Promise.all(
          publicIds.map((publicId) =>
            cloudinary.uploader.destroy(publicId)
          )
        );

        res.status(200).json({
          success: true,
          deleted: publicIds.length,
          results,
        });
      } catch (error: any) {
        console.error("Error in adminDeleteImages:", error);
        const statusCode = error.message?.includes("admin") ? 403 : 500;
        res.status(statusCode).json({
          error: error.message || "Internal server error",
        });
      }
    });
  }
);

/**
 * (E) Public: Liste aller Event-Ordner
 * GET /listEventFolders
 */
export const listEventFolders = onRequest(
  {
    region: "europe-west1",
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Nur GET erlaubt
        if (req.method !== "GET") {
          res.status(405).json({error: "Method not allowed"});
          return;
        }

        // Cloudinary konfigurieren
        configureCloudinary();

        console.log("Searching for event folders in Cloudinary...");

        // Suche nach ALLEN Bildern (ohne Filter)
        const result = await cloudinary.search
          .expression("resource_type:image")
          .max_results(500)
          .execute();

        console.log(`Total images found: ${result.resources?.length || 0}`);

        // Debug: Zeige erste paar Ressourcen
        if (result.resources && result.resources.length > 0) {
          console.log("Sample resources:", JSON.stringify(result.resources.slice(0, 5), null, 2));
        } else {
          console.log("No images found in Cloudinary account!");
        }

        // Extrahiere unique Ordnernamen aus public_id
        const folderSet = new Set<string>();
        result.resources.forEach((resource: any) => {
          const publicId = resource.public_id;
          console.log(`Processing: ${publicId}`);

          // Extrahiere Ordner aus public_id
          // Format kann sein: "events/Fasching 2026/image" oder "Fasching 2026/image"
          if (publicId.includes("/")) {
            const parts = publicId.split("/");
            
            // Fall 1: events/EventName/image -> nimm EventName
            if (parts[0] === "events" && parts.length >= 3) {
              const eventName = parts[1];
              console.log(`  -> Found event (under events/): ${eventName}`);
              folderSet.add(eventName);
            }
            // Fall 2: EventName/image (ohne events/ prefix) -> nimm EventName
            else if (parts.length >= 2) {
              const eventName = parts[0];
              console.log(`  -> Found event (root level): ${eventName}`);
              folderSet.add(eventName);
            }
          }
        });

        const folders = Array.from(folderSet).map((name) => ({
          name,
          path: `events/${name}`,
        }));

        console.log(`Found ${folders.length} unique event folders:`, JSON.stringify(folders));

        res.status(200).json({
          success: true,
          total: folders.length,
          folders,
        });
      } catch (error: any) {
        console.error("Error in listEventFolders:", error);
        res.status(500).json({
          error: error.message || "Internal server error",
        });
      }
    });
  }
);

/**
 * (F) Public: Freigegebene Bilder für ein Event
 * GET /publicApprovedImages?event=<eventSlug>
 */
export const publicApprovedImages = onRequest(
  {
    region: "europe-west1",
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // Nur GET erlaubt
        if (req.method !== "GET") {
          res.status(405).json({error: "Method not allowed"});
          return;
        }

        // Event-Parameter
        const eventSlug = req.query.event as string;
        if (!eventSlug) {
          res.status(400).json({error: "Missing event parameter"});
          return;
        }

        // Cloudinary konfigurieren
        configureCloudinary();

        // Suche nur nach freigegebenen Bildern im Ordner oder mit Tags
        const folderPath = `events/${eventSlug}`;
        const searchExpression =
          `(folder:"${folderPath}" OR tags:event_${eventSlug}) AND tags:approved AND resource_type:image`;

        const result = await cloudinary.search
          .expression(searchExpression)
          .sort_by("created_at", "desc")
          .max_results(500)
          .execute();

        // Formatiere Response
        const images = result.resources.map((img: any) => ({
          public_id: img.public_id,
          secure_url: img.secure_url,
          created_at: img.created_at,
          width: img.width,
          height: img.height,
        }));

        res.status(200).json({
          success: true,
          event: eventSlug,
          total: images.length,
          images,
        });
      } catch (error: any) {
        console.error("Error in publicApprovedImages:", error);
        res.status(500).json({
          error: error.message || "Internal server error",
        });
      }
    });
  }
);
