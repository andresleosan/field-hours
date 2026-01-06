export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      daily_report_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          report_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          report_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          created_at: string
          date: string
          description: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          description: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_used: boolean
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_used?: boolean
          role: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      invoice_extraction_training: {
        Row: {
          created_at: string
          created_by: string
          field_name: string
          field_path: string
          id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          field_name: string
          field_path: string
          id?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          field_name?: string
          field_path?: string
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_extraction_training_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          material_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          material_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          material_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          date: string
          extracted_data: Json | null
          id: string
          image_url: string | null
          invoice_number: string
          needs_review: boolean | null
          notes: string | null
          project_id: string
          supplier_id: string | null
          total_amount: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          date: string
          extracted_data?: Json | null
          id?: string
          image_url?: string | null
          invoice_number: string
          needs_review?: boolean | null
          notes?: string | null
          project_id: string
          supplier_id?: string | null
          total_amount: number
          uploaded_by: string
        }
        Update: {
          created_at?: string
          date?: string
          extracted_data?: Json | null
          id?: string
          image_url?: string | null
          invoice_number?: string
          needs_review?: boolean | null
          notes?: string | null
          project_id?: string
          supplier_id?: string | null
          total_amount?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_collaborators: {
        Row: {
          added_by: string
          created_at: string
          id: string
          job_completion_id: string
          user_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          job_completion_id: string
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          job_completion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_collaborators_job_completion_id_fkey"
            columns: ["job_completion_id"]
            isOneToOne: false
            referencedRelation: "job_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_completion_photos: {
        Row: {
          completion_id: string
          created_at: string
          id: string
          photo_url: string
        }
        Insert: {
          completion_id: string
          created_at?: string
          id?: string
          photo_url: string
        }
        Update: {
          completion_id?: string
          created_at?: string
          id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_completion_photos_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "job_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_completions: {
        Row: {
          completed_at: string
          completed_by: string
          id: string
          job_id: string
          notes: string | null
          submission_number: number | null
          voice_note_url: string | null
        }
        Insert: {
          completed_at?: string
          completed_by: string
          id?: string
          job_id: string
          notes?: string | null
          submission_number?: number | null
          voice_note_url?: string | null
        }
        Update: {
          completed_at?: string
          completed_by?: string
          id?: string
          job_id?: string
          notes?: string | null
          submission_number?: number | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_completions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_materials: {
        Row: {
          created_at: string
          id: string
          job_id: string
          material_usage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          material_usage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          material_usage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_material_usage_id_fkey"
            columns: ["material_usage_id"]
            isOneToOne: false
            referencedRelation: "material_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          created_at: string
          id: string
          job_id: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          photo_url: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_time_tracking: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          job_id: string
          project_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id: string
          project_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id?: string
          project_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_time_tracking_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_time_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          manager_feedback: string | null
          manager_voice_note_url: string | null
          project_id: string
          section: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          manager_feedback?: string | null
          manager_voice_note_url?: string | null
          project_id: string
          section?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          manager_feedback?: string | null
          manager_voice_note_url?: string | null
          project_id?: string
          section?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_delivery_items: {
        Row: {
          created_at: string
          id: string
          material_id: string
          quantity: number
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          quantity: number
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_delivery_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_delivery_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_delivery_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_delivery_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_delivery_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_transfers: {
        Row: {
          id: string
          notes: string | null
          project_id: string
          quantity: number
          storage_material_id: string
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          id?: string
          notes?: string | null
          project_id: string
          quantity: number
          storage_material_id: string
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          id?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          storage_material_id?: string
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transfers_storage_material_id_fkey"
            columns: ["storage_material_id"]
            isOneToOne: false
            referencedRelation: "storage_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_usage: {
        Row: {
          created_at: string
          date: string
          id: string
          job_id: string | null
          material_id: string
          notes: string | null
          project_id: string
          quantity_used: number
          used_by: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          job_id?: string | null
          material_id: string
          notes?: string | null
          project_id: string
          quantity_used: number
          used_by: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          job_id?: string | null
          material_id?: string
          notes?: string | null
          project_id?: string
          quantity_used?: number
          used_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string | null
          cost_per_unit: number
          created_at: string
          id: string
          name: string
          unit: string
        }
        Insert: {
          category?: string | null
          cost_per_unit?: number
          created_at?: string
          id?: string
          name: string
          unit: string
        }
        Update: {
          category?: string | null
          cost_per_unit?: number
          created_at?: string
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      project_switches: {
        Row: {
          from_project_id: string | null
          id: string
          switched_at: string
          to_project_id: string
          travel_time_minutes: number
          user_id: string
        }
        Insert: {
          from_project_id?: string | null
          id?: string
          switched_at?: string
          to_project_id: string
          travel_time_minutes: number
          user_id: string
        }
        Update: {
          from_project_id?: string | null
          id?: string
          switched_at?: string
          to_project_id?: string
          travel_time_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_switches_from_project_id_fkey"
            columns: ["from_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_switches_to_project_id_fkey"
            columns: ["to_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          client_name: string
          created_at: string
          created_by: string
          description: string | null
          finished_at: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_name: string
          created_at?: string
          created_by: string
          description?: string | null
          finished_at?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          description?: string | null
          finished_at?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_assessment_signatures: {
        Row: {
          id: string
          risk_assessment_id: string
          signed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          risk_assessment_id: string
          signed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          risk_assessment_id?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_signatures_risk_assessment_id_fkey"
            columns: ["risk_assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          created_at: string
          id: string
          pdf_url: string
          project_id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_url: string
          project_id: string
          title: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_url?: string
          project_id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rubbish_collection_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          photo_url: string | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          photo_url?: string | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          photo_url?: string | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubbish_collection_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_materials: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          min_stock_level: number | null
          name: string
          notes: string | null
          photo_url: string | null
          quantity: number
          section: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          id?: string
          min_stock_level?: number | null
          name: string
          notes?: string | null
          photo_url?: string | null
          quantity?: number
          section?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          min_stock_level?: number | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          quantity?: number
          section?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      storage_tools: {
        Row: {
          category: string
          condition: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          notes: string | null
          section: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          condition?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          notes?: string | null
          section?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          section?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      time_tracking: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_checkouts: {
        Row: {
          checked_out_at: string
          checked_out_by: string
          condition_on_return: string | null
          created_at: string
          expected_return_date: string | null
          id: string
          notes: string | null
          project_id: string
          returned_at: string | null
          returned_by: string | null
          tool_id: string
        }
        Insert: {
          checked_out_at?: string
          checked_out_by: string
          condition_on_return?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          returned_at?: string | null
          returned_by?: string | null
          tool_id: string
        }
        Update: {
          checked_out_at?: string
          checked_out_by?: string
          condition_on_return?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          returned_at?: string | null
          returned_by?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_checkouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_checkouts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "storage_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      materials_catalog: {
        Row: {
          category: string | null
          created_at: string | null
          id: string | null
          name: string | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          unit?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_completion_owner: {
        Args: { _completion_id: string; _user_id: string }
        Returns: boolean
      }
      use_invitation: {
        Args: { invitation_id: string; user_id: string }
        Returns: boolean
      }
      validate_invitation: {
        Args: {
          user_email: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      validate_invitation_code: {
        Args: { invitation_code: string }
        Returns: {
          error_message: string
          invitation_id: string
          role: Database["public"]["Enums"]["app_role"]
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "manager" | "builder"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["manager", "builder"],
    },
  },
} as const
