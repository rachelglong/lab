using Microsoft.Xrm.Sdk;
using System;

namespace Plugins.Warehouse
{
    public abstract class PluginBase : IPlugin
    {
        private readonly Type _pluginType;

        protected PluginBase(Type pluginType)
        {
            _pluginType = pluginType ?? throw new ArgumentNullException(nameof(pluginType));
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
            {
                throw new ArgumentNullException(nameof(serviceProvider));
            }

            var tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                var localPluginContext = new LocalPluginContext(
                    (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext)),
                    (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory)),
                    tracingService);

                ExecuteDataversePlugin(localPluginContext);
            }
            catch (Exception exception)
            {
                tracingService?.Trace("Unhandled exception in {0}: {1}", _pluginType.FullName, exception);
                throw;
            }
        }

        protected abstract void ExecuteDataversePlugin(ILocalPluginContext localPluginContext);

        private sealed class LocalPluginContext : ILocalPluginContext
        {
            public LocalPluginContext(
                IPluginExecutionContext pluginExecutionContext,
                IOrganizationServiceFactory orgSvcFactory,
                ITracingService tracingService)
            {
                PluginExecutionContext = pluginExecutionContext;
                OrgSvcFactory = orgSvcFactory;
                TracingService = tracingService;
            }

            public IPluginExecutionContext PluginExecutionContext { get; }

            public IOrganizationServiceFactory OrgSvcFactory { get; }

            public ITracingService TracingService { get; }
        }
    }

    public interface ILocalPluginContext
    {
        IPluginExecutionContext PluginExecutionContext { get; }

        IOrganizationServiceFactory OrgSvcFactory { get; }

        ITracingService TracingService { get; }
    }
}
