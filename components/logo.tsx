import { StyleSheet, View, Text, Image } from 'react-native';

export default function Logo() {
    return (
        <View style={styles.imageContainer}>
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: "https://i.imgur.com/EB8Pjg8.png" }}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    imageContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 150,  // Adjust size as needed
        height: 150,
    },
    image: {
        width: '100%',
        height: '100%'
    }
});