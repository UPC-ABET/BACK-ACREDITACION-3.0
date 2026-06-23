export const classRepresentativesRoutes = {
    route: 'admin/academic/class-representatives',
    tag: 'Admin — Class Representatives',
    operation: {
        getAll: { 
            method: 'GET', 
            route: '/get-all', 
            summary: 'List all active class representatives' 
        },
        assign: { 
            method: 'PUT', 
            route: '/assign', 
            summary: 'Assign a student as class representative using student and section codes' 
        },
        remove: { 
            method: 'PUT', 
            route: '/remove', // Se remueve el /:id de la URL para recibir un Body
            summary: 'Remove class representative status using student and section codes' 
        },
    },
};