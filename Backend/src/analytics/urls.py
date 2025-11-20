from django.urls import path
from . import views

urlpatterns = [
    # Datasets
    path("datasets/", views.datasets_list, name="analytics_datasets_list"),
    path("datasets", views.datasets_list, name="analytics_datasets_list_no_slash"),  # Support sans slash
    path("datasets/upload", views.upload_dataset, name="analytics_upload_dataset"),
    path("datasets/<str:table>/preview", views.datasets_preview, name="analytics_datasets_preview"),
    path("datasets/<str:table>/all", views.datasets_all, name="analytics_datasets_all"),  # Toutes les données

    # Queries
    path("query/sql", views.query_sql, name="analytics_query_sql"),
    path("query/nl", views.query_nl, name="analytics_query_nl"),
]
