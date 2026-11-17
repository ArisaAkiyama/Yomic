using System;

namespace Yomic.Core.Models
{
    public class History
    {
        public long Id { get; set; }
        public long ChapterId { get; set; }
        public long MangaId { get; set; } // Redundant but useful for queries
        
        public long LastRead { get; set; } // Epoch time when read
        public long TimeRead { get; set; } // Duration? Or just timestamp. Mihon logic usually tracks *when*.

        public virtual Chapter Chapter { get; set; } = null!;
    }
}
