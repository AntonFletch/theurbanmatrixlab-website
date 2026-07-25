let map;

function initMap() {

    map = new google.maps.Map(document.getElementById("map"), {
        center: {
            lat: 46.8721,
            lng: -113.9940
        },
        zoom: 13
    });

    loadBusinesses();
}


async function loadBusinesses() {

    const { data, error } = await supabaseClient
        .from("businesses")
        .select("*");


    if (error) {
        console.log(error);
        return;
    }


    data.forEach(business => {


        let markerColor = "green";


        if (business.difficulty === "MEDIUM") {
            markerColor = "yellow";
        }


        if (business.difficulty === "HARD") {
            markerColor = "red";
        }


        const marker = new google.maps.Marker({

            position: {
                lat: Number(business.latitude),
                lng: Number(business.longitude)
            },

            map: map,

            title: business.business_name

        });



        const popup = new google.maps.InfoWindow({

            content: `

            <div>

            <h3>${business.business_name}</h3>

            <p>${business.category}</p>

            <p>${business.address}</p>

            <p>
            Difficulty:
            ${business.difficulty}
            </p>

            <p>
            UMX Score:
            ${business.umx_score}
            </p>


            <button onclick="
            window.location.href='customers.html?id=${business.id}'
            ">
            Open Profile
            </button>


            </div>

            `

        });



        marker.addListener("click", () => {

            popup.open({
                anchor: marker,
                map
            });

        });


    });

}
