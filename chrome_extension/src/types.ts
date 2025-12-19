interface BaseMessageType {
  app: "GooglePhotosDeduper";
  action:
    | "healthCheck"
    | "healthCheck.result"
    | "deletePhoto"
    | "deletePhoto.result"
    | "startDeletionTask"
    | "startDeletionTask.result"
    | "stopDeletionTask"
    | "discoverPhotos"
    | "discoverPhotos.progress"
    | "discoverPhotos.result"
    | "sendPhotosToBackend"
    | "sendPhotosToBackend.result";
}

export interface HealthCheckMessageType extends BaseMessageType {
  action: "healthCheck";
}

export interface HealthCheckResultMessageType extends BaseMessageType {
  action: "healthCheck.result";
  success: true;
  version: string;
}

export interface StartDeletionTaskMessageType extends BaseMessageType {
  action: "startDeletionTask";
  mediaItems: {
    id: string;
    productUrl: string;
  }[];
}

export interface StopDeletionTaskMessageType extends BaseMessageType {
  action: "stopDeletionTask";
}

export type StartDeletionTaskResultMessageType = BaseMessageType & {
  action: "startDeletionTask.result";
} & (
    | {
        success: true;
      }
    | {
        success: false;
        error: string;
      }
  );

export interface DeletePhotoMessageType extends BaseMessageType {
  action: "deletePhoto";
  mediaItemId: string;
}

export type DeletePhotoResultMessageType = BaseMessageType & {
  action: "deletePhoto.result";
  mediaItemId: string;
} & (
    | {
        success: true;
        deletedAt: Date;
        userUrl: URL;
      }
    | {
        success: false;
        error: string;
      }
  );

export interface DiscoverPhotosMessageType extends BaseMessageType {
  action: "discoverPhotos";
}

export interface DiscoverPhotosProgressMessageType extends BaseMessageType {
  action: "discoverPhotos.progress";
  photosDiscovered: number;
  currentBatch: number;
}

export type DiscoverPhotosResultMessageType = BaseMessageType & {
  action: "discoverPhotos.result";
} & (
    | {
        success: true;
        totalPhotos: number;
        photos: PhotoMetadata[];
      }
    | {
        success: false;
        error: string;
      }
  );

export interface SendPhotosToBackendMessageType extends BaseMessageType {
  action: "sendPhotosToBackend";
  photos: PhotoMetadata[];
  batchNumber: number;
  totalBatches: number;
  isFinal: boolean;
}

export type SendPhotosToBackendResultMessageType = BaseMessageType & {
  action: "sendPhotosToBackend.result";
} & (
    | {
        success: true;
        received: number;
        totalStored: number;
      }
    | {
        success: false;
        error: string;
      }
  );

export interface PhotoMetadata {
  id: string;
  productUrl: string;
  filename?: string;
  baseUrl?: string;
  mimeType?: string;
  mediaMetadata?: {
    width?: string;
    height?: string;
    creationTime?: string;
  };
}

export type MessageType =
  | HealthCheckMessageType
  | HealthCheckResultMessageType
  | StartDeletionTaskMessageType
  | StartDeletionTaskResultMessageType
  | DeletePhotoMessageType
  | DeletePhotoResultMessageType
  | DiscoverPhotosMessageType
  | DiscoverPhotosProgressMessageType
  | DiscoverPhotosResultMessageType
  | SendPhotosToBackendMessageType
  | SendPhotosToBackendResultMessageType;
