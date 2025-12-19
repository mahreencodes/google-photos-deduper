// Runs on Google Photos web app pages

import { 
  DeletePhotoMessageType, 
  DeletePhotoResultMessageType,
  DiscoverPhotosMessageType,
  DiscoverPhotosProgressMessageType,
  DiscoverPhotosResultMessageType,
  PhotoMetadata 
} from "types";

chrome.runtime.onMessage.addListener(
  (message: any, sender) => {
    if (message?.app !== "GooglePhotosDeduper") {
      // Filter out messages not intended for our app
      // TODO: more thorough vetting
      return;
    }

    if (message?.action === "deletePhoto") {
      handleDeletePhoto(message as DeletePhotoMessageType, sender);
    } else if (message?.action === "discoverPhotos") {
      handleDiscoverPhotos(message as DiscoverPhotosMessageType, sender);
    }
  }
);

function handleDeletePhoto(
  message: DeletePhotoMessageType,
  _sender: chrome.runtime.MessageSender
): void {
  (async () => {
    const resultMessage: Partial<DeletePhotoResultMessageType> = {
      app: "GooglePhotosDeduper",
      action: "deletePhoto.result",
      mediaItemId: message.mediaItemId,
    };

    try {
      await waitForElement("img[aria-label][src*='usercontent']");
    } catch (error) {
      chrome.runtime.sendMessage({
        ...resultMessage,
        success: false,
        error: document.title, // "Can't access photo", "Error 404 (Not Found)!!1", etc.
      });
      return;
    }

    try {
      const trashButton = await waitForElement("[data-delete-origin] button");
      trashButton.click();
    } catch (error) {
      chrome.runtime.sendMessage({
        ...resultMessage,
        success: false,
        error: "Trash button not found",
      });
      return;
    }

    try {
      const confirmButton = await waitForElement("[data-mdc-dialog-button-default]");
      confirmButton.click();
    } catch (error) {
      chrome.runtime.sendMessage({
        ...resultMessage,
        success: false,
        error: "Confirm button not found",
      });
      return;
    }

    try {
      await waitForElement('[role="status"][aria-live="polite"]');
    } catch (error) {
      chrome.runtime.sendMessage({
        ...resultMessage,
        success: false,
        error: "Confirmation toaster not found",
      });
      return;
    }

    chrome.runtime.sendMessage({
      ...resultMessage,
      success: true,
      userUrl: window.location.href,
      deletedAt: new Date(),
    });
  })();
}

function handleDiscoverPhotos(
  message: DiscoverPhotosMessageType,
  _sender: chrome.runtime.MessageSender
): void {
  (async () => {
    const resultMessage: Partial<DiscoverPhotosResultMessageType> = {
      app: "GooglePhotosDeduper",
      action: "discoverPhotos.result",
    };

    try {
      console.log("[Deduper] Starting photo discovery...");
      const photos = await discoverAllPhotos((count, batch) => {
        // Send progress updates
        chrome.runtime.sendMessage({
          app: "GooglePhotosDeduper",
          action: "discoverPhotos.progress",
          photosDiscovered: count,
          currentBatch: batch,
        } as DiscoverPhotosProgressMessageType);
      });

      console.log(`[Deduper] Discovered ${photos.length} photos`);
      
      chrome.runtime.sendMessage({
        ...resultMessage,
        success: true,
        totalPhotos: photos.length,
        photos: photos,
      });
    } catch (error) {
      console.error("[Deduper] Error during photo discovery:", error);
      chrome.runtime.sendMessage({
        ...resultMessage,
        success: false,
        error: String(error),
      });
    }
  })();
}

async function discoverAllPhotos(
  progressCallback: (count: number, batch: number) => void
): Promise<PhotoMetadata[]> {
  const photos: Map<string, PhotoMetadata> = new Map();
  let lastPhotoCount = 0;
  let unchangedCount = 0;
  let batchNumber = 0;
  const maxUnchangedIterations = 5;

  console.log("[Deduper] Starting to discover photos on Google Photos...");

  // Ensure we're on Google Photos main page
  if (!window.location.href.includes("photos.google.com")) {
    throw new Error("Not on Google Photos page");
  }

  // Navigate to "Photos" tab if not already there
  if (!window.location.href.includes("/photos") || window.location.href.includes("/album/")) {
    console.log("[Deduper] Navigating to Photos tab...");
    const photosTab = document.querySelector('a[href^="/photos"]') as HTMLAnchorElement;
    if (photosTab) {
      photosTab.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  while (unchangedCount < maxUnchangedIterations) {
    // Discover photos in current view
    const newPhotos = extractPhotosFromDOM();
    newPhotos.forEach(photo => photos.set(photo.id, photo));

    batchNumber++;
    console.log(`[Deduper] Batch ${batchNumber}: Found ${photos.size} total photos (${newPhotos.length} new)`);
    
    // Send progress update
    progressCallback(photos.size, batchNumber);

    // Check if we found new photos
    if (photos.size === lastPhotoCount) {
      unchangedCount++;
      console.log(`[Deduper] No new photos found (${unchangedCount}/${maxUnchangedIterations})`);
    } else {
      unchangedCount = 0;
      lastPhotoCount = photos.size;
    }

    // Scroll down to load more photos
    const scrollContainer = document.querySelector('[role="main"]') || document.body;
    const previousScrollHeight = scrollContainer.scrollHeight;
    
    window.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: 'smooth'
    });

    // Wait for potential new content to load
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if we actually scrolled (might be at bottom)
    if (scrollContainer.scrollHeight === previousScrollHeight) {
      unchangedCount++;
      console.log(`[Deduper] Reached end of scroll`);
    }
  }

  console.log(`[Deduper] Discovery complete! Found ${photos.size} unique photos`);
  return Array.from(photos.values());
}

function extractPhotosFromDOM(): PhotoMetadata[] {
  const photos: PhotoMetadata[] = [];
  
  // Google Photos uses various selectors for photo items
  // Look for anchor tags with photo URLs
  const photoLinks = document.querySelectorAll('a[href*="/photos/"]');
  
  photoLinks.forEach((link) => {
    try {
      const href = (link as HTMLAnchorElement).href;
      
      // Extract photo ID from URL (format: https://photos.google.com/photo/PHOTO_ID)
      const match = href.match(/\/photos?\/([^/?]+)/);
      if (!match || !match[1]) return;
      
      const photoId = match[1];
      
      // Skip if already processed
      if (photos.some(p => p.id === photoId)) return;
      
      // Find associated image element
      const imgElement = link.querySelector('img') as HTMLImageElement;
      if (!imgElement) return;
      
      // Extract metadata
      const baseUrl = imgElement.src || imgElement.dataset.src;
      if (!baseUrl) return;
      
      const photo: PhotoMetadata = {
        id: photoId,
        productUrl: href,
        baseUrl: baseUrl,
        filename: imgElement.alt || `photo_${photoId}`,
        mimeType: "image/jpeg", // Default, actual type might differ
        mediaMetadata: {
          width: imgElement.naturalWidth?.toString() || imgElement.width?.toString(),
          height: imgElement.naturalHeight?.toString() || imgElement.height?.toString(),
        }
      };
      
      photos.push(photo);
    } catch (error) {
      console.warn("[Deduper] Error extracting photo metadata:", error);
    }
  });
  
  return photos;
}

function waitForElement(
  selector: string,
  timeout: number = 10_000
): Promise<HTMLElement> {
  const findElementPromise = new Promise<HTMLElement>((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector) as HTMLElement);
    }

    const observer = new MutationObserver((_mutations) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector) as HTMLElement);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });

  let timerId: number | undefined;
  const timeoutPromise = new Promise(
    (_resolve, reject) =>
      (timerId = setTimeout(
        () =>
          reject(
            `Timeout: selector \`${selector}\` not found after ${timeout}ms`
          ),
        timeout
      ))
  );

  return Promise.race([findElementPromise, timeoutPromise]).finally(() =>
    clearTimeout(timerId)
  ) as Promise<HTMLElement>;
}
