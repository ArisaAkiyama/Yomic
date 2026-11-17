using AngleSharp;
using AngleSharp.Dom;
using System;
using System.Linq;

namespace Yomic.Core.Sources
{
    public class JsResponse
    {
        public string body { get; set; } = "";
        public int status { get; set; }
        public string text() => body;
    }

    public class JsElement
    {
        private readonly IElement _element;
        private readonly string _baseUri;

        public JsElement(IElement element, string baseUri)
        {
            _element = element;
            _baseUri = baseUri;
        }

        public string text() => _element.TextContent?.Trim() ?? "";
        
        public string attr(string name) => _element.GetAttribute(name) ?? "";
        
        public string outerHtml() => _element.OuterHtml;
        
        public string innerHtml() => _element.InnerHtml;

        public string tagName => _element.TagName;

        public JsElement? parentElement => _element.ParentElement != null ? new JsElement(_element.ParentElement, _baseUri) : null;

        public JsElement? nextElementSibling => _element.NextElementSibling != null ? new JsElement(_element.NextElementSibling, _baseUri) : null;

        public JsElement? querySelector(string selector)
        {
            var el = _element.QuerySelector(selector);
            return el != null ? new JsElement(el, _baseUri) : null;
        }

        public JsElement[] querySelectorAll(string selector)
        {
            return _element.QuerySelectorAll(selector).Select(el => new JsElement(el, _baseUri)).ToArray();
        }
        
        public string absUrl(string attrName)
        {
            var val = attr(attrName);
            if (string.IsNullOrEmpty(val)) return "";
            if (val.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || val.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) return val;
            
            try
            {
                if (Uri.TryCreate(new Uri(_baseUri), val, out var resolvedUri))
                {
                    return resolvedUri.AbsoluteUri;
                }
            }
            catch {}
            return val;
        }
    }

    public class JsDocument
    {
        private readonly IDocument _document;
        private readonly string _baseUri;

        public JsDocument(IDocument document, string baseUri)
        {
            _document = document;
            _baseUri = baseUri;
        }

        public JsElement? querySelector(string selector)
        {
            var el = _document.QuerySelector(selector);
            return el != null ? new JsElement(el, _baseUri) : null;
        }

        public JsElement[] querySelectorAll(string selector)
        {
            return _document.QuerySelectorAll(selector).Select(el => new JsElement(el, _baseUri)).ToArray();
        }
    }

    public static class HtmlParser
    {
        private static readonly IBrowsingContext _context = BrowsingContext.New(Configuration.Default);
        
        public static JsDocument parse(string html, string baseUri)
        {
            var parser = _context.GetService<AngleSharp.Html.Parser.IHtmlParser>();
            if (parser == null)
            {
                // Fallback direct instantiation if service is null
                parser = new AngleSharp.Html.Parser.HtmlParser();
            }
            var doc = parser.ParseDocument(html);
            return new JsDocument(doc, baseUri);
        }
    }
}
