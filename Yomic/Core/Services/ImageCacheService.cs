using System;
using System.Collections.Concurrent;
using System.Linq;
using Avalonia.Media.Imaging;
using BitFaster.Caching;
using BitFaster.Caching.Lru;

namespace Yomic.Core.Services
{
    public class CachedBitmap
    {
        public Bitmap Bitmap { get; }
        public CachedBitmap(Bitmap bitmap)
        {
            Bitmap = bitmap;
        }
    }

    public class ImageCacheService
    {
        // High-performance lock-free Concurrent LRU Cache powered by BitFaster.Caching (Max 1000 items in RAM)
        // Wrapped in CachedBitmap to prevent BitFaster from disposing bitmaps while UI elements are rendering them
        private readonly ICache<string, CachedBitmap> _lruCache;
        
        // L2 WeakReference cache for soft memory references
        private readonly ConcurrentDictionary<string, WeakReference<Bitmap>> _weakCache = new();

        public ImageCacheService()
        {
            _lruCache = new ConcurrentLruBuilder<string, CachedBitmap>()
                .WithCapacity(1000)
                .Build();
        }

        public Bitmap? GetImage(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;

            // 1. Try L1 Lock-free Concurrent LRU Cache
            if (_lruCache.TryGet(url, out var cached))
            {
                if (cached?.Bitmap != null)
                {
                    return cached.Bitmap;
                }
            }

            // 2. Try L2 Weak Cache Fallback
            if (_weakCache.TryGetValue(url, out var weakRef))
            {
                if (weakRef.TryGetTarget(out var weakBitmap))
                {
                    _lruCache.AddOrUpdate(url, new CachedBitmap(weakBitmap));
                    return weakBitmap;
                }
                else
                {
                    _weakCache.TryRemove(url, out _);
                }
            }

            return null;
        }

        public void AddImage(string url, Bitmap bitmap)
        {
            if (string.IsNullOrEmpty(url) || bitmap == null) return;

            // Add/Update to L1 Concurrent LRU Cache
            _lruCache.AddOrUpdate(url, new CachedBitmap(bitmap));

            // Add/Update to L2 Weak Cache
            _weakCache.AddOrUpdate(url, new WeakReference<Bitmap>(bitmap), (k, v) => new WeakReference<Bitmap>(bitmap));
        }

        public void Clear()
        {
            _lruCache.Clear();
            _weakCache.Clear();
        }

        /// <summary>
        /// Clears all cached images for a specific source based on URL pattern matching
        /// </summary>
        /// <param name="sourceBaseUrl">Base URL of the source (e.g., "komikcast.fit", "komiku.org")</param>
        public void ClearForSource(string sourceBaseUrl)
        {
            if (string.IsNullOrEmpty(sourceBaseUrl)) return;
            
            string domain = sourceBaseUrl;
            if (Uri.TryCreate(sourceBaseUrl, UriKind.Absolute, out var uri))
            {
                domain = uri.Host;
            }
            else
            {
                domain = sourceBaseUrl.Replace("https://", "").Replace("http://", "").TrimEnd('/');
            }
            
            var keysToRemove = _weakCache.Keys.Where(url => url.Contains(domain, StringComparison.OrdinalIgnoreCase)).ToList();
            foreach (var key in keysToRemove)
            {
                _weakCache.TryRemove(key, out _);
                _lruCache.TryRemove(key);
            }
            
            LogService.Info("ImageCacheService", $"Cleared {keysToRemove.Count} cached images for source: {domain}");
        }
    }
}
