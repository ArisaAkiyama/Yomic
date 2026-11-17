using System.Threading.Tasks;

namespace Yomic.Core.Sources
{
    /// <summary>
    /// Marker interface for sources that support Cloudflare bypass via browser automation.
    /// Sources implementing this interface will show a "Verify" button in the Extensions UI.
    /// </summary>
    public interface ICloudflareBypassable
    {
        /// <summary>
        /// Initializes an automated browser session to solve Cloudflare challenges.
        /// This method will open a browser window where the user can complete CAPTCHAs.
        /// </summary>
        Task InitializeBrowserAsync();
    }
}
