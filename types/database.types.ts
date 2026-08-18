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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          contacto_nombre: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nombre_comercial: string
          notas: string | null
          razon_social: string | null
          rfc: string | null
          telefono: string | null
        }
        Insert: {
          contacto_nombre?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre_comercial: string
          notas?: string | null
          razon_social?: string | null
          rfc?: string | null
          telefono?: string | null
        }
        Update: {
          contacto_nombre?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre_comercial?: string
          notas?: string | null
          razon_social?: string | null
          rfc?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      consumo_material_orden: {
        Row: {
          cantidad_estimada: number | null
          cantidad_real: number
          created_at: string
          id: string
          lote_id: string
          material_id: string
        }
        Insert: {
          cantidad_estimada?: number | null
          cantidad_real?: number
          created_at?: string
          id?: string
          lote_id: string
          material_id: string
        }
        Update: {
          cantidad_estimada?: number | null
          cantidad_real?: number
          created_at?: string
          id?: string
          lote_id?: string
          material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumo_material_orden_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_material_orden_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          created_at: string
          estatus: Database["public"]["Enums"]["estatus_entrega"]
          fecha_programada: string
          fecha_real: string | null
          firma_url: string | null
          id: string
          notas: string | null
          pedido_id: string
          recibido_por: string | null
          registrado_por: string | null
        }
        Insert: {
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_entrega"]
          fecha_programada: string
          fecha_real?: string | null
          firma_url?: string | null
          id?: string
          notas?: string | null
          pedido_id: string
          recibido_por?: string | null
          registrado_por?: string | null
        }
        Update: {
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_entrega"]
          fecha_programada?: string
          fecha_real?: string | null
          firma_url?: string | null
          id?: string
          notas?: string | null
          pedido_id?: string
          recibido_por?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_proceso: {
        Row: {
          activo: boolean
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      incidencias_produccion: {
        Row: {
          created_at: string
          descripcion: string
          foto_url: string | null
          gravedad: string
          id: string
          lote_etapa_id: string | null
          lote_id: string
          reportado_por: string | null
          resuelto: boolean
        }
        Insert: {
          created_at?: string
          descripcion: string
          foto_url?: string | null
          gravedad?: string
          id?: string
          lote_etapa_id?: string | null
          lote_id: string
          reportado_por?: string | null
          resuelto?: boolean
        }
        Update: {
          created_at?: string
          descripcion?: string
          foto_url?: string | null
          gravedad?: string
          id?: string
          lote_etapa_id?: string | null
          lote_id?: string
          reportado_por?: string | null
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_produccion_lote_etapa_id_fkey"
            columns: ["lote_etapa_id"]
            isOneToOne: false
            referencedRelation: "lote_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_produccion_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_produccion_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items_orden_produccion: {
        Row: {
          cantidad_planeada: number
          id: string
          lote_id: string
          modelo_id: string
          talla_id: string
          variante_id: string | null
        }
        Insert: {
          cantidad_planeada: number
          id?: string
          lote_id: string
          modelo_id: string
          talla_id: string
          variante_id?: string | null
        }
        Update: {
          cantidad_planeada?: number
          id?: string
          lote_id?: string
          modelo_id?: string
          talla_id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_orden_produccion_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_orden_produccion_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_orden_produccion_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_orden_produccion_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      items_pedido: {
        Row: {
          cantidad: number
          id: string
          modelo_id: string
          notas: string | null
          pedido_id: string
          precio_unitario: number | null
          talla_id: string
          variante_id: string | null
        }
        Insert: {
          cantidad: number
          id?: string
          modelo_id: string
          notas?: string | null
          pedido_id: string
          precio_unitario?: number | null
          talla_id: string
          variante_id?: string | null
        }
        Update: {
          cantidad?: number
          id?: string
          modelo_id?: string
          notas?: string | null
          pedido_id?: string
          precio_unitario?: number | null
          talla_id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_pedido_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_pedido_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_pedido_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_etapas: {
        Row: {
          cantidad_completada: number
          estatus: string
          etapa_id: string
          id: string
          item_orden_id: string
          lote_id: string
          orden_secuencia: number
        }
        Insert: {
          cantidad_completada?: number
          estatus?: string
          etapa_id: string
          id?: string
          item_orden_id: string
          lote_id: string
          orden_secuencia: number
        }
        Update: {
          cantidad_completada?: number
          estatus?: string
          etapa_id?: string
          id?: string
          item_orden_id?: string
          lote_id?: string
          orden_secuencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "lote_etapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_proceso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_etapas_item_orden_id_fkey"
            columns: ["item_orden_id"]
            isOneToOne: false
            referencedRelation: "items_orden_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_etapas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_produccion: {
        Row: {
          creado_por: string | null
          created_at: string
          estatus: Database["public"]["Enums"]["estatus_orden"]
          fecha_fin_estimada: string | null
          fecha_fin_real: string | null
          fecha_inicio: string | null
          folio: string
          id: string
          notas: string | null
          pedido_id: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_orden"]
          fecha_fin_estimada?: string | null
          fecha_fin_real?: string | null
          fecha_inicio?: string | null
          folio: string
          id?: string
          notas?: string | null
          pedido_id?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_orden"]
          fecha_fin_estimada?: string | null
          fecha_fin_real?: string | null
          fecha_inicio?: string | null
          folio?: string
          id?: string
          notas?: string | null
          pedido_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_produccion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produccion_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      materiales: {
        Row: {
          categoria: string | null
          costo_unitario: number | null
          created_at: string
          id: string
          nombre: string
          stock_actual: number
          stock_minimo: number
          unidad_medida: string
        }
        Insert: {
          categoria?: string | null
          costo_unitario?: number | null
          created_at?: string
          id?: string
          nombre: string
          stock_actual?: number
          stock_minimo?: number
          unidad_medida: string
        }
        Update: {
          categoria?: string | null
          costo_unitario?: number | null
          created_at?: string
          id?: string
          nombre?: string
          stock_actual?: number
          stock_minimo?: number
          unidad_medida?: string
        }
        Relationships: []
      }
      modelos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
        }
        Relationships: []
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          lote_id: string | null
          material_id: string
          motivo: string | null
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          lote_id?: string | null
          material_id: string
          motivo?: string | null
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          lote_id?: string | null
          material_id?: string
          motivo?: string | null
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_stock_producto: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          modelo_id: string
          motivo: string | null
          orden_produccion_id: string | null
          registrado_por: string | null
          talla_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          variante_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          modelo_id: string
          motivo?: string | null
          orden_produccion_id?: string | null
          registrado_por?: string | null
          talla_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          variante_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          modelo_id?: string
          motivo?: string | null
          orden_produccion_id?: string | null
          registrado_por?: string | null
          talla_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_orden_produccion_id_fkey"
            columns: ["orden_produccion_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          creado_por: string | null
          created_at: string
          estatus: Database["public"]["Enums"]["estatus_pedido"]
          fecha_compromiso: string
          fecha_pedido: string
          folio: string
          id: string
          notas: string | null
        }
        Insert: {
          cliente_id: string
          creado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_pedido"]
          fecha_compromiso: string
          fecha_pedido?: string
          folio: string
          id?: string
          notas?: string | null
        }
        Update: {
          cliente_id?: string
          creado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_pedido"]
          fecha_compromiso?: string
          fecha_pedido?: string
          folio?: string
          id?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre_completo: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          usuario_corto: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id: string
          nombre_completo: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          usuario_corto?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre_completo?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          usuario_corto?: string | null
        }
        Relationships: []
      }
      plantilla_items: {
        Row: {
          cantidad_sugerida: number | null
          id: string
          modelo_id: string
          plantilla_id: string
          talla_id: string
          variante_id: string | null
        }
        Insert: {
          cantidad_sugerida?: number | null
          id?: string
          modelo_id: string
          plantilla_id: string
          talla_id: string
          variante_id?: string | null
        }
        Update: {
          cantidad_sugerida?: number | null
          id?: string
          modelo_id?: string
          plantilla_id?: string
          talla_id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_items_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_items_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_items_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_pedido: {
        Row: {
          cliente_id: string | null
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_avance_colaborador: {
        Row: {
          cantidad: number
          colaborador_id: string
          created_at: string
          fecha: string
          foto_url: string | null
          id: string
          lote_etapa_id: string
          lote_id: string
          observaciones: string | null
          origen: Database["public"]["Enums"]["origen_avance"]
          registrado_por: string
        }
        Insert: {
          cantidad: number
          colaborador_id: string
          created_at?: string
          fecha?: string
          foto_url?: string | null
          id?: string
          lote_etapa_id: string
          lote_id: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["origen_avance"]
          registrado_por: string
        }
        Update: {
          cantidad?: number
          colaborador_id?: string
          created_at?: string
          fecha?: string
          foto_url?: string | null
          id?: string
          lote_etapa_id?: string
          lote_id?: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["origen_avance"]
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_avance_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_avance_colaborador_lote_etapa_id_fkey"
            columns: ["lote_etapa_id"]
            isOneToOne: false
            referencedRelation: "lote_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_avance_colaborador_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_avance_colaborador_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_productos: {
        Row: {
          cantidad_actual: number
          id: string
          modelo_id: string
          talla_id: string
          variante_id: string | null
        }
        Insert: {
          cantidad_actual?: number
          id?: string
          modelo_id: string
          talla_id: string
          variante_id?: string | null
        }
        Update: {
          cantidad_actual?: number
          id?: string
          modelo_id?: string
          talla_id?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_productos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_productos_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_productos_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      tallas: {
        Row: {
          codigo: string
          id: string
          orden: number
        }
        Insert: {
          codigo: string
          id?: string
          orden: number
        }
        Update: {
          codigo?: string
          id?: string
          orden?: number
        }
        Relationships: []
      }
      variantes: {
        Row: {
          color: string | null
          created_at: string
          diseno: string | null
          id: string
          modelo_id: string
          sku: string | null
          tela: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          diseno?: string | null
          id?: string
          modelo_id: string
          sku?: string | null
          tela?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          diseno?: string | null
          id?: string
          modelo_id?: string
          sku?: string | null
          tela?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variantes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
    }
    Enums: {
      estatus_entrega: "programada" | "en_ruta" | "entregada" | "cancelada"
      estatus_orden: "planeada" | "en_proceso" | "terminada" | "cancelada"
      estatus_pedido:
        | "cotizacion"
        | "confirmado"
        | "en_produccion"
        | "listo"
        | "entregado"
        | "cancelado"
      origen_avance: "colaborador" | "ajuste_supervisor"
      rol_usuario: "admin" | "ventas" | "supervisor" | "colaborador"
      tipo_movimiento: "entrada" | "salida" | "ajuste"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estatus_entrega: ["programada", "en_ruta", "entregada", "cancelada"],
      estatus_orden: ["planeada", "en_proceso", "terminada", "cancelada"],
      estatus_pedido: [
        "cotizacion",
        "confirmado",
        "en_produccion",
        "listo",
        "entregado",
        "cancelado",
      ],
      origen_avance: ["colaborador", "ajuste_supervisor"],
      rol_usuario: ["admin", "ventas", "supervisor", "colaborador"],
      tipo_movimiento: ["entrada", "salida", "ajuste"],
    },
  },
} as const

// Alias de conveniencia usados en el resto de la app.
export type RolUsuario = Database["public"]["Enums"]["rol_usuario"]
export type EstatusPedido = Database["public"]["Enums"]["estatus_pedido"]
export type EstatusOrden = Database["public"]["Enums"]["estatus_orden"]
export type OrigenAvance = Database["public"]["Enums"]["origen_avance"]
export type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"]
export type EstatusEntrega = Database["public"]["Enums"]["estatus_entrega"]
