using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Yomic.Core.Helpers
{
    /// <summary>
    /// Natural Sort order implementation.
    /// Supports "Chapter 1, Chapter 2, Chapter 10" and "10.5".
    /// </summary>
    public class NaturalStringComparer : IComparer<string>
    {
        private readonly bool _descending;

        public NaturalStringComparer(bool descending = false)
        {
            _descending = descending;
        }

        public int Compare(string? x, string? y)
        {
            if (x == y) return 0;
            if (x == null) return -1;
            if (y == null) return 1;

            var result = CompareNatural(x, y);
            return _descending ? -result : result;
        }

        private static readonly Regex _chunkRegex = new Regex(@"(\d+(\.\d+)?)", RegexOptions.Compiled);

        private int CompareNatural(string strA, string strB)
        {
            var chunksA = _chunkRegex.Split(strA);
            var chunksB = _chunkRegex.Split(strB);

            for (int i = 0; i < Math.Min(chunksA.Length, chunksB.Length); i++)
            {
                var chunkA = chunksA[i];
                var chunkB = chunksB[i];

                if (string.IsNullOrWhiteSpace(chunkA) && string.IsNullOrWhiteSpace(chunkB)) continue;

                bool isNumA = float.TryParse(chunkA, NumberStyles.Any, CultureInfo.InvariantCulture, out float numA);
                bool isNumB = float.TryParse(chunkB, NumberStyles.Any, CultureInfo.InvariantCulture, out float numB);

                if (isNumA && isNumB)
                {
                    int cmp = numA.CompareTo(numB);
                    if (cmp != 0) return cmp;
                }
                else
                {
                    int cmp = string.Compare(chunkA, chunkB, StringComparison.OrdinalIgnoreCase);
                    if (cmp != 0) return cmp;
                }
            }

            return chunksA.Length.CompareTo(chunksB.Length);
        }
    }
}
