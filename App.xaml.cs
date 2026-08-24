using System;
using System.Windows;

namespace Cryo
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                {
                    MessageBox.Show($"Cryo Startup Warning:\n{ex.Message}", "Cryo Diagnostics");
                }
            };

            DispatcherUnhandledException += (s, args) =>
            {
                args.Handled = true;
                MessageBox.Show($"Cryo Error:\n{args.Exception.Message}", "Cryo Diagnostics");
            };
        }
    }
}
