using Vv1.DashSync;

string targetDirectory = args.Length > 0 
    ? args[0] 
    : Path.Combine(Directory.GetCurrentDirectory(), "cache");

await new PhotoSyncService().SyncPhotos(Path.GetFullPath(targetDirectory));
