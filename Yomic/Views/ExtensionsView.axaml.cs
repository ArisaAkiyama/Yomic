using System.Threading.Tasks;
using Avalonia.Controls;
using Yomic.ViewModels;

namespace Yomic.Views
{
    public partial class ExtensionsView : UserControl
    {
        public ExtensionsView()
        {
            InitializeComponent();
            DataContextChanged += OnDataContextChanged;
        }

        private void OnDataContextChanged(object? sender, System.EventArgs e)
        {
            if (DataContext is ExtensionsViewModel vm)
            {
                vm.RequestManageReposDialogAsync = ShowManageReposDialogAsync;
            }
        }

        private async Task ShowManageReposDialogAsync()
        {
            var topLevel = TopLevel.GetTopLevel(this);
            if (topLevel is Window parentWindow)
            {
                var dialog = new ExtensionReposDialog();
                await dialog.ShowDialog(parentWindow);
            }
        }
    }
}
