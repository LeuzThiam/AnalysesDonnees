from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),

    # APIs
    path("api/common/", include("common.urls")),
    path("api/auth/", include("users.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/integrations/", include("integrations.urls")),  # <= nouveau
]
